import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const input = z.object({
  name: z.string().trim().min(2).max(120),
  brandName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

async function handlePOST(req: Request) {
  try {
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Invalid signup details";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const clientRole = await db.role.findUnique({ where: { key: "CLIENT" } });
    if (!clientRole) {
      return NextResponse.json({ error: "Client signup is not configured yet" }, { status: 503 });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const result = await db.$transaction(async (tx) => {
      const existingClient = await tx.client.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          users: { none: {} },
        },
        orderBy: { createdAt: "desc" },
      });

      // Anyone can type an existing client's email, so an account claiming an existing
      // client starts as PENDING until the agency confirms it. A brand-new client is active
      // immediately because it only gives access to its own, empty workspace.
      const createdUser = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          phone: parsed.data.phone || null,
          passwordHash,
          roleId: clientRole.id,
          status: existingClient ? "PENDING" : "ACTIVE",
        },
      });

      const client = existingClient || await tx.client.create({
        data: {
          brandName: parsed.data.brandName,
          contactName: parsed.data.name,
          phone: parsed.data.phone || null,
          email,
          status: "ACTIVE",
        },
      });

      await tx.clientUser.create({
        data: { clientId: client.id, userId: createdUser.id },
      });

      await tx.auditLog.create({
        data: {
          userId: createdUser.id,
          action: "CLIENT_SELF_SIGNUP",
          entityType: "User",
          entityId: createdUser.id,
          newValue: {
            clientId: client.id,
            brandName: client.brandName,
            email,
            pendingApproval: Boolean(existingClient),
          },
        },
      });

      return { user: createdUser, client, pending: Boolean(existingClient) };
    });

    if (result.pending) {
      const staff = await db.user.findMany({
        where: { status: "ACTIVE", role: { key: { in: ["ADMIN", "MANAGER"] } } },
        select: { id: true },
      });
      if (staff.length) {
        await notify(staff.map((item) => item.id), {
          kind: "SYSTEM",
          title: "Client account waiting for approval",
          body: `${result.user.name} (${email}) signed up for ${result.client.brandName}. Confirm it in Users by setting the status to Active.`,
          deepLink: "/users",
        });
      }
      return NextResponse.json({ ok: true, pending: true }, { status: 201 });
    }

    await createSession(result.user.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Client signup error:", error);
    return NextResponse.json({ error: "Could not create account. Please try again." }, { status: 500 });
  }
}

export const POST = api(handlePOST);
