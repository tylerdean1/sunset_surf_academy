export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      custom_oauth_providers: {
        Row: {
          acceptable_client_ids: string[]
          attribute_mapping: Json
          authorization_params: Json
          authorization_url: string | null
          cached_discovery: Json | null
          client_id: string
          client_secret: string
          created_at: string
          custom_claims_allowlist: string[]
          discovery_cached_at: string | null
          discovery_url: string | null
          email_optional: boolean
          enabled: boolean
          id: string
          identifier: string
          issuer: string | null
          jwks_uri: string | null
          name: string
          pkce_enabled: boolean
          provider_type: string
          scopes: string[]
          skip_nonce_check: boolean
          token_url: string | null
          updated_at: string
          userinfo_url: string | null
        }
        Insert: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id: string
          client_secret: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier: string
          issuer?: string | null
          jwks_uri?: string | null
          name: string
          pkce_enabled?: boolean
          provider_type: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Update: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id?: string
          client_secret?: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier?: string
          issuer?: string | null
          jwks_uri?: string | null
          name?: string
          pkce_enabled?: boolean
          provider_type?: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string | null
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string | null
          email_optional: boolean
          id: string
          invite_token: string | null
          linking_target_id: string | null
          oauth_client_state_id: string | null
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          referrer: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id?: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_code_sets: {
        Row: {
          created_at: string
          failed_verification_count: number
          id: string
          mfa_factor_id: string
          updated_at: string
          user_id: string
          verification_locked_until: string | null
        }
        Insert: {
          created_at?: string
          failed_verification_count?: number
          id: string
          mfa_factor_id: string
          updated_at?: string
          user_id: string
          verification_locked_until?: string | null
        }
        Update: {
          created_at?: string
          failed_verification_count?: number
          id?: string
          mfa_factor_id?: string
          updated_at?: string
          user_id?: string
          verification_locked_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_code_sets_mfa_factor_id_fkey"
            columns: ["mfa_factor_id"]
            isOneToOne: true
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mfa_recovery_code_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          id: string
          mfa_recovery_code_set_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          id: string
          mfa_recovery_code_set_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          mfa_recovery_code_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_mfa_recovery_code_set_id_fkey"
            columns: ["mfa_recovery_code_set_id"]
            isOneToOne: false
            referencedRelation: "mfa_recovery_code_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          nonce?: string | null
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Insert: {
          code_verifier?: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          id?: string
          provider_type?: string
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            isOneToOne: false
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      scim_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          prefix: string
          revoked_at: string | null
          sso_provider_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id: string
          last_used_at?: string | null
          prefix: string
          revoked_at?: string | null
          sso_provider_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          prefix?: string
          revoked_at?: string | null
          sso_provider_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_users: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          external_id: string | null
          id: string
          resource: Json
          sso_provider_id: string
          updated_at: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id: string
          resource: Json
          sso_provider_id: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          resource?: Json
          sso_provider_id?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_users_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scim_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          scopes: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          expires_at: string
          id: string
          session_data: Json
          user_id: string | null
        }
        Insert: {
          challenge_type: string
          created_at?: string
          expires_at: string
          id?: string
          session_data: Json
          user_id?: string | null
        }
        Update: {
          challenge_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          session_data?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          aaguid: string | null
          attestation_type: string
          backed_up: boolean
          backup_eligible: boolean
          created_at: string
          credential_id: string
          friendly_name: string
          id: string
          last_used_at: string | null
          public_key: string
          sign_count: number
          transports: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id?: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: { Args: never; Returns: string }
      jwt: { Args: never; Returns: Json }
      role: { Args: never; Returns: string }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone" | "recovery_code"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: string | null
        }
        Relationships: []
      }
      booking_notifications: {
        Row: {
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
        }
        Insert: {
          attempts?: number
          booking_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          payload: Json
          provider_message_id?: string | null
          recipient_kind: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          booking_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_kind?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_request_rate_limits: {
        Row: {
          key: string
          requests: number
          window_start: string
        }
        Insert: {
          key: string
          requests: number
          window_start: string
        }
        Update: {
          key?: string
          requests?: number
          window_start?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
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
        }
        Insert: {
          amount_paid_cents?: number
          approved_session_id?: string | null
          balance_cents?: number | null
          bill_total_cents?: number | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          manual_bill_total_cents?: number | null
          manual_pricing?: boolean
          notes?: string | null
          party_names?: string[] | null
          party_size: number
          requested_date: string
          requested_lesson_type: string
          requested_time_labels?: string[]
          requested_time_slots?: string | null
          selected_time_slot?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          submission_hash?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number
          approved_session_id?: string | null
          balance_cents?: number | null
          bill_total_cents?: number | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          manual_bill_total_cents?: number | null
          manual_pricing?: boolean
          notes?: string | null
          party_names?: string[] | null
          party_size?: number
          requested_date?: string
          requested_lesson_type?: string
          requested_time_labels?: string[]
          requested_time_slots?: string | null
          selected_time_slot?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          submission_hash?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_approved_session_id_fkey"
            columns: ["approved_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_requested_lesson_type_fk"
            columns: ["requested_lesson_type"]
            isOneToOne: false
            referencedRelation: "lesson_types"
            referencedColumns: ["key"]
          },
        ]
      }
      business_expenses: {
        Row: {
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
        }
        Insert: {
          category: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          description?: string | null
          expense_date: string
          id?: string
          is_refund?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          tip_cents?: number | null
          total_cents: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_refund?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          tip_cents?: number | null
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_page_content: {
        Row: {
          approved: boolean
          body_en: string | null
          body_es_draft: string | null
          body_es_published: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          page_key: string
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved?: boolean
          body_en?: string | null
          body_es_draft?: string | null
          body_es_published?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          page_key: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved?: boolean
          body_en?: string | null
          body_es_draft?: string | null
          body_es_published?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          page_key?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lesson_types: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
          key: string
          price_per_person_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          is_active?: boolean
          key: string
          price_per_person_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          is_active?: boolean
          key?: string
          price_per_person_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
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
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          bucket: string
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          path: string
          public: boolean
          session_id?: string | null
          sort?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          bucket?: string
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          path?: string
          public?: boolean
          session_id?: string | null
          sort?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_slots: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          slot_key: string
          sort: number
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          slot_key: string
          sort?: number
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          slot_key?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_slots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          anchor: string | null
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
        }
        Insert: {
          anchor?: string | null
          content_source?: Json
          created_at?: string
          id?: string
          kind: string
          media_source?: Json
          meta?: Json
          page_key: string
          sort?: number
          status?: string
          updated_at?: string
        }
        Update: {
          anchor?: string | null
          content_source?: Json
          created_at?: string
          id?: string
          kind?: string
          media_source?: Json
          meta?: Json
          page_key?: string
          sort?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
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
        }
        Insert: {
          category: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          is_refund?: boolean
          notes?: string | null
          parent_receipt_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_date: string
          receipt_storage_path: string
          session_id?: string | null
          source_type?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          tip_cents?: number | null
          total_cents: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["finance_category"]
          created_at?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          is_refund?: boolean
          notes?: string | null
          parent_receipt_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_date?: string
          receipt_storage_path?: string
          session_id?: string | null
          source_type?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          tip_cents?: number | null
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "business_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_parent_receipt_id_fkey"
            columns: ["parent_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
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
        }
        Insert: {
          bill_total?: number
          client_names?: string[] | null
          created_at?: string
          deleted_at?: string | null
          group_size?: number | null
          id?: string
          lesson_status?: Database["public"]["Enums"]["lesson_status"] | null
          lesson_type_key?: string | null
          notes?: string | null
          paid?: number
          session_time?: string | null
          tip?: number | null
        }
        Update: {
          bill_total?: number
          client_names?: string[] | null
          created_at?: string
          deleted_at?: string | null
          group_size?: number | null
          id?: string
          lesson_status?: Database["public"]["Enums"]["lesson_status"] | null
          lesson_type_key?: string | null
          notes?: string | null
          paid?: number
          session_time?: string | null
          tip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_lesson_type_key_fk"
            columns: ["lesson_type_key"]
            isOneToOne: false
            referencedRelation: "lesson_types"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_apply_booking_request_payment: {
        Args: { p_delta_cents: number; p_id: string }
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
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_clear_media_asset_slots: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
      admin_create_business_expense: {
        Args: {
          p_category: Database["public"]["Enums"]["finance_category"]
          p_description?: string
          p_expense_date: string
          p_is_refund?: boolean
          p_notes?: string
          p_parent_expense_id?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_subtotal_cents?: number
          p_tax_cents?: number
          p_tip_cents?: number
          p_total_cents: number
          p_transaction_id?: string
          p_vendor_name?: string
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
        }
        SetofOptions: {
          from: "*"
          to: "business_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_expense_receipt: {
        Args: {
          p_category: Database["public"]["Enums"]["finance_category"]
          p_description?: string
          p_expense_id: string
          p_is_refund?: boolean
          p_notes?: string
          p_parent_receipt_id?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_receipt_date: string
          p_receipt_storage_path: string
          p_source_type?: string
          p_subtotal_cents?: number
          p_tax_cents?: number
          p_tip_cents?: number
          p_total_cents: number
          p_transaction_id?: string
          p_vendor_name?: string
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
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_session: {
        Args: {
          p_client_names?: string[]
          p_group_size?: number
          p_lesson_status?: Database["public"]["Enums"]["lesson_status"]
          p_lesson_type_key?: string
          p_paid?: number
          p_session_time?: string
          p_tip?: number
        }
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
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_decide_booking_request: {
        Args: {
          p_action: string
          p_decision_reason?: string
          p_id: string
          p_selected_time_label?: string
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
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_business_expense: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_delete_page_content: {
        Args: { p_page_key: string }
        Returns: undefined
      }
      admin_delete_receipt: { Args: { p_id: string }; Returns: undefined }
      admin_delete_session: { Args: { p_id: string }; Returns: undefined }
      admin_get_cms_page_row: {
        Args: { p_page_key: string }
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
      }
      admin_hard_delete_session: { Args: { p_id: string }; Returns: undefined }
      admin_list_booking_requests: {
        Args: { p_show_all?: boolean }
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
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_business_expenses_range: {
        Args: { p_end: string; p_start: string }
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
        SetofOptions: {
          from: "*"
          to: "business_expenses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_cms_page_content: {
        Args: { p_category: string; p_limit?: number; p_page_key_like?: string }
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
      }
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
        SetofOptions: {
          from: "*"
          to: "lesson_types"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      }
      admin_list_media_slots_by_prefix: {
        Args: { p_prefix: string }
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
      }
      admin_list_receipts_for_expense: {
        Args: { p_expense_id: string }
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
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_sessions:
        | {
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
            SetofOptions: {
              from: "*"
              to: "sessions"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { include_deleted?: boolean }
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
            SetofOptions: {
              from: "*"
              to: "sessions"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      admin_map_session_to_lesson_type: {
        Args: { p_session_ids: string[] }
        Returns: {
          lesson_type: string
          session_id: string
        }[]
      }
      admin_publish_es: { Args: { p_page_key: string }; Returns: undefined }
      admin_relocate_receipt: {
        Args: {
          p_category: Database["public"]["Enums"]["finance_category"]
          p_expected_path: string
          p_id: string
          p_new_path: string
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
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_replace_gallery_images:
        | { Args: { p_asset_ids: string[] }; Returns: undefined }
        | { Args: { p_asset_ids?: string[]; p_count: number }; Returns: number }
      admin_restore_session: { Args: { p_id: string }; Returns: undefined }
      admin_save_content_bundle: {
        Args: { p_media: Json; p_strings: Json }
        Returns: undefined
      }
      admin_save_media_asset: {
        Args: { p_asset: Json; p_slot_keys?: string[] }
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
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_media_slot: {
        Args: { p_asset_id?: string; p_slot_key: string; p_sort?: number }
        Returns: undefined
      }
      admin_update_booking_request: {
        Args: { p_id: string; p_patch: Json }
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
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_booking_request_billing: {
        Args: {
          p_amount_paid_cents?: number
          p_bill_total_cents?: number
          p_id: string
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
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_business_expense: {
        Args: {
          p_category: Database["public"]["Enums"]["finance_category"]
          p_description?: string
          p_expense_date: string
          p_id: string
          p_is_refund?: boolean
          p_notes?: string
          p_parent_expense_id?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_subtotal_cents?: number
          p_tax_cents?: number
          p_tip_cents?: number
          p_total_cents: number
          p_transaction_id?: string
          p_vendor_name?: string
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
        }
        SetofOptions: {
          from: "*"
          to: "business_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_lesson_type: {
        Args: {
          p_description?: string
          p_display_name?: string
          p_key: string
          p_price_per_person_cents?: number
        }
        Returns: {
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
          key: string
          price_per_person_cents: number
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lesson_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_receipt: {
        Args: {
          p_category: Database["public"]["Enums"]["finance_category"]
          p_description?: string
          p_id: string
          p_is_refund?: boolean
          p_notes?: string
          p_parent_receipt_id?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_receipt_date: string
          p_receipt_storage_path: string
          p_source_type?: string
          p_subtotal_cents?: number
          p_tax_cents?: number
          p_tip_cents?: number
          p_total_cents: number
          p_transaction_id?: string
          p_vendor_name?: string
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
        }
        SetofOptions: {
          from: "*"
          to: "receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_session: {
        Args: {
          p_client_names?: string[]
          p_group_size?: number
          p_id: string
          p_lesson_status?: Database["public"]["Enums"]["lesson_status"]
          p_lesson_type_key?: string
          p_paid?: number
          p_session_time?: string
          p_tip?: number
        }
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
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_session_v2: {
        Args: {
          p_bill_total?: number
          p_lesson_status?: string
          p_notes?: string
          p_paid?: number
          p_session_id: string
          p_session_time?: string
          p_tip?: number
        }
        Returns: undefined
      }
      admin_upsert_media_asset:
        | {
            Args: {
              p_asset_type: Database["public"]["Enums"]["asset_type"]
              p_bucket: string
              p_category: Database["public"]["Enums"]["photo_category"]
              p_description?: string
              p_id?: string
              p_path: string
              p_public: boolean
              p_session_id?: string
              p_sort?: number
              p_title: string
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
            }
            SetofOptions: {
              from: "*"
              to: "media_assets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_asset_key?: string
              p_asset_type: Database["public"]["Enums"]["asset_type"]
              p_bucket: string
              p_category: Database["public"]["Enums"]["photo_category"]
              p_description?: string
              p_id?: string
              p_path: string
              p_public: boolean
              p_session_id?: string
              p_sort?: number
              p_title: string
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
            }
            SetofOptions: {
              from: "*"
              to: "media_assets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      admin_upsert_page_content: {
        Args: {
          p_approved?: boolean
          p_body_en?: string
          p_body_es_draft?: string
          p_body_es_published?: string
          p_category?: string
          p_page_key: string
          p_sort?: number
        }
        Returns: undefined
      }
      claim_booking_notifications: {
        Args: { p_booking_id?: string; p_limit?: number }
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
        SetofOptions: {
          from: "*"
          to: "booking_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_booking_notification: {
        Args: {
          p_error?: string
          p_id: string
          p_lease_token: string
          p_provider_id?: string
        }
        Returns: undefined
      }
      compute_booking_request_bill_total_cents: {
        Args: { p_lesson_type_key: string; p_party_size: number }
        Returns: number
      }
      configure_booking_email_worker: {
        Args: { p_url: string }
        Returns: undefined
      }
      get_page_content: {
        Args: { p_locale?: string; p_page_key: string }
        Returns: {
          body: string
          locale: string
          page_key: string
          updated_at: string
        }[]
      }
      get_page_content_by_prefix: {
        Args: { p_locale?: string; p_prefix: string }
        Returns: {
          body: string
          locale: string
          page_key: string
          updated_at: string
        }[]
      }
      get_public_media_asset_by_key: {
        Args: { p_slot_key: string }
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
      }
      get_public_media_assets: {
        Args: { p_category?: Database["public"]["Enums"]["photo_category"] }
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
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_media_assets_by_prefix: {
        Args: { p_prefix: string }
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
      }
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
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_site_admin: { Args: never; Returns: boolean }
      is_valid_json: { Args: { p_text: string }; Returns: boolean }
      rpc_create_page_section: {
        Args: {
          p_anchor?: string
          p_kind: string
          p_meta?: Json
          p_page_key: string
          p_sort?: number
          p_status?: string
        }
        Returns: string
      }
      rpc_delete_page_section: {
        Args: { p_page_key: string; p_section_id: string }
        Returns: undefined
      }
      rpc_get_page_sections: {
        Args: { p_include_drafts?: boolean; p_page_key: string }
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
      }
      rpc_upsert_page_sections: {
        Args: {
          p_page_key: string
          p_prune_missing?: boolean
          p_sections: Json
        }
        Returns: undefined
      }
      submit_booking_request: {
        Args: { p_payload: Json; p_payload_hash: string; p_rate_key: string }
        Returns: Json
      }
      sync_media_assets_from_storage: {
        Args: never
        Returns: {
          inserted: number
          updated: number
        }[]
      }
      verify_booking_worker_secret: {
        Args: { p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_type: "video" | "photo"
      booking_request_status: "pending" | "approved" | "denied" | "canceled"
      Days_of_the_week:
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
      finance_category:
        | "fuel"
        | "equipment"
        | "advertising"
        | "lessons"
        | "food"
        | "software"
        | "payroll"
        | "other"
      lesson_status:
        | "booked_unpaid"
        | "completed"
        | "canceled_with_refund"
        | "canceled_without_refund"
        | "booked_paid_in_full"
      payment_method: "cash" | "card" | "ach" | "check" | "stripe" | "other"
      photo_category:
        | "logo"
        | "hero"
        | "lessons"
        | "web_content"
        | "uncategorized"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone", "recovery_code"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  public: {
    Enums: {
      asset_type: ["video", "photo"],
      booking_request_status: ["pending", "approved", "denied", "canceled"],
      Days_of_the_week: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      finance_category: [
        "fuel",
        "equipment",
        "advertising",
        "lessons",
        "food",
        "software",
        "payroll",
        "other",
      ],
      lesson_status: [
        "booked_unpaid",
        "completed",
        "canceled_with_refund",
        "canceled_without_refund",
        "booked_paid_in_full",
      ],
      payment_method: ["cash", "card", "ach", "check", "stripe", "other"],
      photo_category: [
        "logo",
        "hero",
        "lessons",
        "web_content",
        "uncategorized",
      ],
    },
  },
} as const
