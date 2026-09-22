type BufferChannel = {
  id: string;
  name: string;
  service: string;
};

type BufferOrganization = {
  id: string;
  name: string;
};

type BufferPost = {
  id: string;
  status?: string | null;
  sentAt?: string | null;
  sharedNow?: boolean | null;
};

const endpoint = "https://api.buffer.com";

function apiKey() {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error("BUFFER_API_KEY_MISSING");
  return key;
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok) throw new Error(`BUFFER_HTTP_${response.status}`);
  if (!payload) throw new Error("BUFFER_INVALID_RESPONSE");
  if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message || "Buffer error").join("; "));
  if (!payload.data) throw new Error("BUFFER_EMPTY_RESPONSE");
  return payload.data;
}

export function bufferConfigured() {
  return Boolean(process.env.BUFFER_API_KEY);
}

export async function listBufferChannels() {
  const account = await gql<{ account: { organizations: BufferOrganization[] } }>(`
    query BufferOrganizations {
      account {
        organizations { id name }
      }
    }
  `);

  const groups = await Promise.all(account.account.organizations.map(async (organization) => {
    const data = await gql<{ channels: BufferChannel[] }>(`
      query BufferChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          service
        }
      }
    `, { organizationId: organization.id });

    return {
      organization,
      channels: data.channels,
    };
  }));

  return groups;
}

export async function createBufferPost(input: {
  channelId: string;
  text: string;
  assets: Array<{ image?: { url: string }; video?: { url: string; metadata?: { thumbnailOffset?: number } } }>;
  metadata?: Record<string, unknown>;
}) {
  const data = await gql<{ createPost: { post?: BufferPost; message?: string } }>(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            status
            sentAt
            sharedNow
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `, {
    input: {
      text: input.text,
      channelId: input.channelId,
      schedulingType: "automatic",
      mode: "shareNow",
      assets: input.assets,
      metadata: input.metadata,
      source: "24i-production",
    },
  });

  if (!data.createPost.post) throw new Error(data.createPost.message || "BUFFER_CREATE_POST_FAILED");
  return data.createPost.post;
}

export async function getBufferPost(id: string) {
  const data = await gql<{ post: BufferPost }>(`
    query BufferPost($id: PostId!) {
      post(input: { id: $id }) {
        id
        status
        sentAt
        sharedNow
      }
    }
  `, { id });
  return data.post;
}
