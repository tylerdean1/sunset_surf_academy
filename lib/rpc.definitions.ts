// AUTO-GENERATED — DO NOT EDIT. Run npm run gen:rpc

import type { Database } from './database.types';

export const RPC_NAMES = [
  'admin_apply_booking_request_payment',
  'admin_clear_media_asset_slots',
  'admin_create_business_expense',
  'admin_create_expense_receipt',
  'admin_create_session',
  'admin_decide_booking_request',
  'admin_delete_business_expense',
  'admin_delete_page_content',
  'admin_delete_receipt',
  'admin_delete_session',
  'admin_get_cms_page_row',
  'admin_hard_delete_session',
  'admin_list_booking_requests',
  'admin_list_business_expenses_range',
  'admin_list_cms_page_content',
  'admin_list_lesson_types',
  'admin_list_media_assets',
  'admin_list_media_assets_with_key',
  'admin_list_media_slots_by_prefix',
  'admin_list_receipts_for_expense',
  'admin_list_sessions',
  'admin_map_session_to_lesson_type',
  'admin_publish_es',
  'admin_replace_gallery_images',
  'admin_restore_session',
  'admin_set_media_slot',
  'admin_update_booking_request',
  'admin_update_booking_request_billing',
  'admin_update_business_expense',
  'admin_update_lesson_type',
  'admin_update_receipt',
  'admin_update_session',
  'admin_update_session_v2',
  'admin_upsert_media_asset',
  'admin_upsert_page_content',
  'compute_booking_request_bill_total_cents',
  'get_page_content',
  'get_page_content_by_prefix',
  'get_public_media_asset_by_key',
  'get_public_media_assets',
  'get_public_media_assets_by_prefix',
  'get_public_sessions',
  'is_admin',
  'is_site_admin',
  'is_valid_json',
  'rpc_create_page_section',
  'rpc_delete_page_section',
  'rpc_get_page_sections',
  'rpc_upsert_page_sections',
  'sync_media_assets_from_storage',
] as const;

export type RpcName = typeof RPC_NAMES[number];
export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args'];
export type RpcReturns<N extends RpcName> = Database['public']['Functions'][N]['Returns'];

export function isRpcName(value: string): value is RpcName {
  return (RPC_NAMES as readonly string[]).includes(value);
}
