// AUTO-GENERATED — DO NOT EDIT. Run npm run rpcmap

import type { Database, Json } from './database.types';

export type TableRpcMap = {
  admin_users: {
  },
  booking_notifications: {
    claim_booking_notifications: {
      Args: {
        p_booking_id?: string
        p_limit?: number
      }
      Returns: {
        attempts: number
        booking_id: string
        created_at: string
        id: string
        last_error: string | null
        lease_expires_at: string | null
        lease_token: string | null
        next_attempt_at: string
        payload: Json
        provider_message_id: string | null
        recipient_kind: string
        status: string
        updated_at: string
      }[]
    },
  },
  booking_request_rate_limits: {
  },
  booking_requests: {
    admin_list_booking_requests: {
      Args: {
        p_show_all?: boolean
      }
      Returns: {
        amount_paid_cents: number
        approved_session_id: string | null
        balance_cents: number | null
        bill_total_cents: number | null
        created_at: string
        customer_email: string
        customer_name: string
        customer_phone: string
        decided_at: string | null
        decided_by: string | null
        decision_reason: string | null
        id: string
        manual_bill_total_cents: number | null
        manual_pricing: boolean
        notes: string | null
        party_names: string[] | null
        party_size: number
        requested_date: string
        requested_lesson_type: string
        requested_time_labels: string[]
        requested_time_slots: string | null
        selected_time_slot: string | null
        status: Database["public"]["Enums"]["booking_request_status"]
        submission_hash: string | null
        submission_id: string | null
        updated_at: string
      }[]
    },
  },
  business_expenses: {
    admin_list_business_expenses_range: {
      Args: {
        p_end: string
        p_start: string
      }
      Returns: {
        category: Database["public"]["Enums"]["finance_category"]
        created_at: string
        description: string | null
        expense_date: string
        id: string
        is_refund: boolean
        notes: string | null
        parent_expense_id: string | null
        payment_method: Database["public"]["Enums"]["payment_method"] | null
        subtotal_cents: number | null
        tax_cents: number | null
        tip_cents: number | null
        total_cents: number
        transaction_id: string | null
        updated_at: string
        vendor_name: string | null
      }[]
    },
  },
  cms_page_content: {
    admin_list_cms_page_content: {
      Args: {
        p_category: string
        p_limit?: number
        p_page_key_like?: string
      }
      Returns: {
        approved: boolean
        body_en: string
        body_es_draft: string
        body_es_published: string
        category: string
        id: string
        page_key: string
        sort: number
        updated_at: string
      }[]
    },
  },
  lesson_types: {
    admin_list_lesson_types: {
      Args: never
      Returns: {
        created_at: string
        description: string | null
        display_name: string
        is_active: boolean
        key: string
        price_per_person_cents: number
        sort_order: number
        updated_at: string
      }[]
    },
  },
  media_assets: {
    admin_list_media_assets: {
      Args: never
      Returns: {
        asset_type: Database["public"]["Enums"]["asset_type"]
        bucket: string
        category: Database["public"]["Enums"]["photo_category"]
        created_at: string | null
        description: string | null
        id: string
        path: string
        public: boolean
        session_id: string | null
        sort: number
        title: string
        updated_at: string | null
      }[]
    },
    admin_list_media_assets_with_key: {
      Args: never
      Returns: {
        asset_key: string
        asset_type: Database["public"]["Enums"]["asset_type"]
        bucket: string
        category: Database["public"]["Enums"]["photo_category"]
        created_at: string
        description: string
        id: string
        path: string
        public: boolean
        session_id: string
        sort: number
        title: string
        updated_at: string
      }[]
    },
    get_public_media_assets: {
      Args: {
        p_category?: Database["public"]["Enums"]["photo_category"]
      }
      Returns: {
        asset_type: Database["public"]["Enums"]["asset_type"]
        bucket: string
        category: Database["public"]["Enums"]["photo_category"]
        created_at: string | null
        description: string | null
        id: string
        path: string
        public: boolean
        session_id: string | null
        sort: number
        title: string
        updated_at: string | null
      }[]
    },
    get_public_media_assets_by_prefix: {
      Args: {
        p_prefix: string
      }
      Returns: {
        asset_type: Database["public"]["Enums"]["asset_type"]
        bucket: string
        category: Database["public"]["Enums"]["photo_category"]
        created_at: string
        description: string
        id: string
        path: string
        public: boolean
        session_id: string
        slot_key: string
        sort: number
        title: string
        updated_at: string
      }[]
    },
    sync_media_assets_from_storage: {
      Args: never
      Returns: {
        inserted: number
        updated: number
      }[]
    },
  },
  media_slots: {
    admin_list_media_slots_by_prefix: {
      Args: {
        p_prefix: string
      }
      Returns: {
        asset_bucket: string
        asset_category: Database["public"]["Enums"]["photo_category"]
        asset_id: string
        asset_path: string
        asset_public: boolean
        asset_title: string
        asset_type: Database["public"]["Enums"]["asset_type"]
        slot_key: string
        sort: number
      }[]
    },
  },
  page_sections: {
    rpc_get_page_sections: {
      Args: {
        p_include_drafts?: boolean
        p_page_key: string
      }
      Returns: {
        anchor: string
        content_source: Json
        created_at: string
        id: string
        kind: string
        media_source: Json
        meta: Json
        page_key: string
        sort: number
        status: string
        updated_at: string
      }[]
    },
    rpc_upsert_page_sections: {
      Args: {
        p_page_key: string
        p_prune_missing?: boolean
        p_sections: Json
      }
      Returns: undefined
    },
  },
  receipts: {
    admin_list_receipts_for_expense: {
      Args: {
        p_expense_id: string
      }
      Returns: {
        category: Database["public"]["Enums"]["finance_category"]
        created_at: string
        description: string | null
        expense_id: string | null
        id: string
        is_refund: boolean
        notes: string | null
        parent_receipt_id: string | null
        payment_method: Database["public"]["Enums"]["payment_method"] | null
        receipt_date: string
        receipt_storage_path: string
        session_id: string | null
        source_type: string | null
        subtotal_cents: number | null
        tax_cents: number | null
        tip_cents: number | null
        total_cents: number
        transaction_id: string | null
        updated_at: string
        vendor_name: string | null
      }[]
    },
  },
  sessions: {
    get_public_sessions: {
      Args: never
      Returns: {
        bill_total: number
        client_names: string[] | null
        created_at: string
        deleted_at: string | null
        group_size: number | null
        id: string
        lesson_status: Database["public"]["Enums"]["lesson_status"] | null
        lesson_type_key: string | null
        notes: string | null
        paid: number
        session_time: string | null
        tip: number | null
      }[]
    },
  },
};
