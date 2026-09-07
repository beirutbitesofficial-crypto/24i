"use client";

import { useEffect } from "react";

const dictionary: Record<string, string> = {
  "General settings": "الإعدادات العامة",
  "Company name": "اسم الشركة",
  "Currency": "العملة",
  "Timezone": "المنطقة الزمنية",
  "Default language": "اللغة الافتراضية",
  "Save settings": "حفظ الإعدادات",
  "Test notifications": "اختبار الإشعارات",
  "Admin only": "للمدير فقط",
  "Send test notification to all users": "إرسال إشعار تجريبي لكل المستخدمين",
  "Create user": "إضافة مستخدم",
  "User management": "إدارة المستخدمين",
  "Name": "الاسم",
  "Email": "البريد الإلكتروني",
  "Temporary password": "كلمة مرور مؤقتة",
  "Role": "الدور",
  "Client access / assignments": "العملاء المسموح الوصول إليهم",
  "Create user": "إضافة مستخدم",
  "Assigned clients": "العملاء المعيّنون",
  "Reset password": "إعادة تعيين كلمة المرور",
  "Status": "الحالة",
  "Save user": "حفظ المستخدم",
  "Last login": "آخر تسجيل دخول",
  "Roles & access": "الأدوار والصلاحيات",
  "People": "المستخدمون",
  "Clients & projects": "العملاء والمشاريع",
  "Tasks": "المهام",
  "Content": "المحتوى",
  "Calendar & files": "التقويم والملفات",
  "Packages": "الباقات",
  "Finance": "المالية",
  "System": "النظام",
  "Save": "حفظ",
  "New client": "عميل جديد",
  "Clients": "العملاء",
  "Brand name": "اسم البراند",
  "Industry": "المجال",
  "Contact name": "اسم جهة الاتصال",
  "Phone": "الهاتف",
  "WhatsApp": "واتساب",
  "Website": "الموقع الإلكتروني",
  "Instagram": "إنستغرام",
  "Facebook": "فيسبوك",
  "TikTok": "تيك توك",
  "Start date": "تاريخ البداية",
  "Contract end date": "نهاية العقد",
  "Payment due day": "يوم استحقاق الدفع",
  "Notes": "ملاحظات",
  "Create client": "إضافة العميل",
  "New project": "مشروع جديد",
  "Project name": "اسم المشروع",
  "Client": "العميل",
  "Create project": "إنشاء المشروع",
  "Task title": "عنوان المهمة",
  "Category": "الفئة",
  "Priority": "الأولوية",
  "Due date & time": "الموعد النهائي",
  "Description": "الوصف",
  "Assignees": "المكلّفون",
  "Create task": "إنشاء المهمة",
  "Title": "العنوان",
  "Type": "النوع",
  "Owner": "المسؤول",
  "Platforms": "المنصات",
  "Create content": "إنشاء المحتوى",
  "Files": "الملفات",
  "Upload file": "رفع ملف",
  "Choose file": "اختيار ملف",
  "Upload": "رفع",
  "Calendar": "التقويم",
  "Date": "التاريخ",
  "Date & time": "التاريخ والوقت",
  "Schedule": "جدولة",
  "Notifications": "الإشعارات",
  "Mark read": "تحديد كمقروء",
  "Reports": "التقارير",
  "Settings": "الإعدادات",
  "Audit": "سجل التدقيق",
  "Payments": "المدفوعات",
  "Invoices": "الفواتير",
  "Expenses": "المصاريف",
  "Salaries": "الرواتب",
  "Amount": "المبلغ",
  "Paid": "مدفوع",
  "Unpaid": "غير مدفوع",
  "Partially paid": "مدفوع جزئياً",
  "Create invoice": "إنشاء فاتورة",
  "Add payment": "إضافة دفعة",
  "Add expense": "إضافة مصروف",
  "Add salary": "إضافة راتب",
  "No clients yet.": "ما في عملاء بعد.",
  "No tasks yet.": "ما في مهام بعد.",
  "No content yet.": "ما في محتوى بعد.",
  "No notifications yet.": "ما في إشعارات بعد.",
  "ACTIVE": "نشط",
  "PENDING": "معلّق",
  "DISABLED": "معطّل",
  "LOW": "منخفضة",
  "MEDIUM": "متوسطة",
  "HIGH": "عالية",
  "URGENT": "عاجلة",
  "TODO": "جديدة",
  "IN PROGRESS": "قيد التنفيذ",
  "REVIEW": "مراجعة",
  "REVISION": "تعديل",
  "WAITING CLIENT": "بانتظار العميل",
  "COMPLETED": "مكتملة",
  "Create": "إنشاء",
  "Cancel": "إلغاء",
  "Close": "إغلاق",
  "Edit": "تعديل",
  "Delete": "حذف",
  "Search": "بحث",
  "Filter": "تصفية",
};

const allowed = new Set(["BUTTON", "LABEL", "LEGEND", "TH", "OPTION", "H2", "H3"]);

function translateNode(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("[data-no-translate]")) continue;
    const canTranslate = allowed.has(parent.tagName) || parent.classList.contains("eyebrow") || parent.classList.contains("muted");
    if (!canTranslate) continue;
    const raw = node.nodeValue || "";
    const trimmed = raw.trim();
    const translated = dictionary[trimmed];
    if (!translated) continue;
    node.nodeValue = raw.replace(trimmed, translated);
  }
}

export function ArabicUi() {
  useEffect(() => {
    const root = document.querySelector(".workspace");
    if (!root) return;
    translateNode(root);
    const observer = new MutationObserver(() => translateNode(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    return () => observer.disconnect();
  }, []);
  return null;
}
