// AUTO-GENERATED — DO NOT EDIT. Run npm run gen:policies

export interface Policy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: boolean;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

export const POLICIES: Policy[] = [
  {
    "schemaname": "public",
    "tablename": "admin_users",
    "policyname": "admins can manage admin_users",
    "permissive": true,
    "roles": [
      "public"
    ],
    "cmd": "ALL",
    "qual": "is_site_admin()",
    "with_check": "is_site_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "booking_requests",
    "policyname": "admins can delete booking requests",
    "permissive": true,
    "roles": [
      "public"
    ],
    "cmd": "DELETE",
    "qual": "is_site_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "booking_requests",
    "policyname": "admins can read booking requests",
    "permissive": true,
    "roles": [
      "public"
    ],
    "cmd": "SELECT",
    "qual": "is_site_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "booking_requests",
    "policyname": "admins can update booking requests",
    "permissive": true,
    "roles": [
      "public"
    ],
    "cmd": "UPDATE",
    "qual": "is_site_admin()",
    "with_check": "is_site_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "business_expenses",
    "policyname": "admin_delete",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "DELETE",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "business_expenses",
    "policyname": "admin_insert",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "INSERT",
    "qual": null,
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "business_expenses",
    "policyname": "admin_select",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "business_expenses",
    "policyname": "admin_update",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "UPDATE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "cms_page_content",
    "policyname": "admin_all_cms_page_content",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "ALL",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "cms_page_content",
    "policyname": "public_read_home_section_meta",
    "permissive": true,
    "roles": [
      "anon",
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "((category = 'sections.page.home'::text) AND (page_key ~~ 'section.%.meta'::text))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "lesson_types",
    "policyname": "lesson_types_active_read",
    "permissive": true,
    "roles": [
      "anon",
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "is_active",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "media_assets",
    "policyname": "Allow admin full access on media_assets",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "ALL",
    "qual": "((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'admin'::text)",
    "with_check": "((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "media_assets",
    "policyname": "Allow public read on media_assets",
    "permissive": true,
    "roles": [
      "anon",
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "(public = true)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "media_slots",
    "policyname": "Public can read slots for public assets",
    "permissive": true,
    "roles": [
      "anon",
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "((asset_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM media_assets ma\n  WHERE ((ma.id = media_slots.asset_id) AND (ma.public = true)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "page_sections",
    "policyname": "page_sections_admin_select_all",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "is_site_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "page_sections",
    "policyname": "page_sections_select_published",
    "permissive": true,
    "roles": [
      "anon",
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "(status = 'published'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "receipts",
    "policyname": "admin_delete",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "DELETE",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "receipts",
    "policyname": "admin_insert",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "INSERT",
    "qual": null,
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "receipts",
    "policyname": "admin_select",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "receipts",
    "policyname": "admin_update",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "UPDATE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "admin_delete",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "DELETE",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "admin_insert",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "INSERT",
    "qual": null,
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "admin_select",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "SELECT",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sessions",
    "policyname": "admin_update",
    "permissive": true,
    "roles": [
      "authenticated"
    ],
    "cmd": "UPDATE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  }
];
