export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ── Enums ─────────────────────────────────────────────────────────────────────

export type WalletType        = 'unisat' | 'xverse' | 'leather'
export type AuthMethod        = 'email' | 'wallet' | 'both'
export type ListingCategory   = 'job' | 'gig' | 'service' | 'good'
export type ListingStatus     = 'pending_payment' | 'open' | 'claimed' | 'completed' | 'disputed'
export type PricingType       = 'hourly' | 'fixed'
export type LicenseType       = 'personal' | 'commercial' | 'exclusive'
export type WaitlistUserType  = 'human' | 'agent_builder'
export type InvoiceType       = 'agent_registration' | 'listing_fee' | 'escrow_funding' | 'trust_deposit' | 'verification'
export type InvoiceStatus     = 'pending' | 'paid' | 'expired'
export type EscrowStatus      = 'pending_funding' | 'funded' | 'completed' | 'disputed' | 'cancelled' | 'refunded'
export type DisputeStatus     = 'open' | 'resolved' | 'cancelled'
export type TxType            = 'escrow_received' | 'cashout' | 'platform_fee' | 'listing_fee' | 'registration_fee'
export type WorkerAvailability = 'full_time' | 'part_time' | 'weekends'

// ── Row types ─────────────────────────────────────────────────────────────────

export type UserRow = {
  id:                     string
  email:                  string
  name:                   string | null
  bio:                    string | null
  location:               string | null
  avatar_url:             string | null
  skills:                 string[]
  usd_balance_cents:      number
  payout_info:            Json | null
  rating:                 number
  completed_task_count:   number
  strike_customer_id:     string | null
  btc_wallet_address:     string | null
  wallet_type:            WalletType | null
  auth_method:            AuthMethod
  // Verification + trust deposit (added in migration 0010)
  is_verified:            boolean
  verification_method:    'wallet' | 'sat_payment' | 'phone' | null
  trust_deposit_paid:     boolean
  trust_deposit_sats:     number
  trust_deposit_returned: boolean
  // Agent-native auth (added in migration 0012)
  is_agent:               boolean
  created_at:             string
}

export type AgentApiKeyRow = {
  id:           string
  agent_id:     string
  key_hash:     string   // SHA-256 — never expose to client
  key_prefix:   string   // first 8 chars — safe to display
  label:        string | null
  last_used_at: string | null
  created_at:   string
  revoked_at:   string | null
}

export type AuthChallengeRow = {
  id:             string
  wallet_address: string
  nonce:          string
  expires_at:     string
  used:           boolean
  created_at:     string
}

export type AgentRow = {
  id:                       string
  btc_wallet_address:       string
  name:                     string
  description:              string | null
  capabilities:             string[]
  owner_id:                 string
  spending_limit_sats:      number
  model_version:            string | null
  reputation_score:         number
  tasks_posted_count:       number
  sats_spent_total:         number
  verified:                 boolean
  verified_at:              string | null
  registration_invoice_id:  string | null
  created_at:               string
}

export type ListingRow = {
  id:                    string
  title:                 string
  description:           string
  price_sats:            number
  creator_user_id:       string | null
  creator_agent_id:      string | null
  claimed_by_user_id:    string | null
  claimed_by_agent_id:   string | null
  claimed_at:            string | null
  category:              ListingCategory
  status:                ListingStatus
  tags:                  string[]
  post_fee_paid:         boolean
  post_invoice_id:       string | null
  // Fee breakdown (added in migration 0010, derived from price_sats)
  platform_fee_sats:     number | null
  total_agent_cost_sats: number | null
  human_payout_sats:     number | null
  // Image (added in migration 0011)
  image_url:             string | null
  image_path:            string | null
  created_at:            string
  updated_at:            string
}

export type ListingJobRow = {
  listing_id:               string
  deadline:                 string | null
  required_skills:          string[]
  deliverable_description:  string | null
  milestone_flag:           boolean
}

export type ListingGigRow = {
  listing_id:                 string
  delivery_time_hours:        number | null
  revision_count:             number
  recurring:                  boolean
  turnaround_guarantee_hours: number | null
}

export type ListingServiceRow = {
  listing_id:               string
  pricing_type:             PricingType
  availability_text:        string | null
  minimum_engagement:       string | null
  response_time_sla_hours:  number | null
}

export type ListingGoodRow = {
  listing_id:         string
  file_type:          string | null
  license_type:       LicenseType
  instant_delivery:   boolean
  preview_available:  boolean
}

export type WaitlistRow = {
  id:             string
  email:          string
  user_type:      WaitlistUserType
  referral_code:  string
  referred_by:    string | null
  position:       number | null
  created_at:     string
}

export type LightningInvoiceRow = {
  id:                string
  invoice_type:      InvoiceType
  entity_id:         string
  strike_invoice_id: string
  amount_sats:       number
  status:            InvoiceStatus
  created_at:        string
  paid_at:           string | null
}

export type EscrowContractRow = {
  id:                 string
  listing_id:         string
  bitescrow_cid:      string | null
  buyer_user_id:      string | null
  buyer_agent_id:     string | null
  seller_user_id:     string | null
  seller_agent_id:    string | null
  amount_sats:        number
  platform_fee_sats:  number
  status:             EscrowStatus
  created_at:         string
  funded_at:          string | null
  settled_at:         string | null
}

export type DisputeRow = {
  id:                 string
  contract_id:        string
  raised_by_user_id:  string
  reason:             string
  status:             DisputeStatus
  resolution_notes:   string | null
  created_at:         string
  resolved_at:        string | null
}

export type TransactionRow = {
  id:           string
  user_id:      string
  tx_type:      TxType
  amount_sats:  number
  usd_cents:    number | null
  reference_id: string | null
  created_at:   string
}

export type TrustDepositRow = {
  id:           string
  user_id:      string
  amount_sats:  number
  invoice_id:   string | null
  status:       'pending' | 'paid' | 'returned' | 'forfeited'
  created_at:   string
  returned_at:  string | null
  forfeited_at: string | null
}

export type WorkerProfileRow = {
  id:                    string
  user_id:               string
  headline:              string
  bio:                   string | null
  location:              string | null
  hourly_rate_usd_cents: number
  availability:          WorkerAvailability
  skills:                string[]
  is_active:             boolean
  created_at:            string
  updated_at:            string
}

export type BtcPriceCacheRow = {
  id:         number
  price_usd:  number
  updated_at: string
}

// ── Insert types ──────────────────────────────────────────────────────────────

export type UserInsert           = Pick<UserRow, 'id' | 'email'> & Partial<UserRow>
export type AgentInsert          = Pick<AgentRow, 'btc_wallet_address' | 'name' | 'owner_id'> & Partial<AgentRow>
export type ListingInsert        = Pick<ListingRow, 'title' | 'description' | 'price_sats' | 'category'> & Partial<ListingRow>
export type ListingJobInsert     = Pick<ListingJobRow, 'listing_id'> & Partial<ListingJobRow>
export type ListingGigInsert     = Pick<ListingGigRow, 'listing_id'> & Partial<ListingGigRow>
export type ListingServiceInsert = Pick<ListingServiceRow, 'listing_id' | 'pricing_type'> & Partial<ListingServiceRow>
export type ListingGoodInsert    = Pick<ListingGoodRow, 'listing_id' | 'license_type'> & Partial<ListingGoodRow>
export type WaitlistInsert       = Pick<WaitlistRow, 'email' | 'user_type' | 'referral_code'> & Partial<WaitlistRow>
export type LightningInvoiceInsert = Pick<LightningInvoiceRow, 'invoice_type' | 'entity_id' | 'strike_invoice_id' | 'amount_sats'> & Partial<LightningInvoiceRow>
export type EscrowContractInsert = Pick<EscrowContractRow, 'listing_id' | 'amount_sats' | 'platform_fee_sats'> & Partial<EscrowContractRow>
export type DisputeInsert        = Pick<DisputeRow, 'contract_id' | 'raised_by_user_id' | 'reason'> & Partial<DisputeRow>
export type TransactionInsert    = Pick<TransactionRow, 'user_id' | 'tx_type' | 'amount_sats'> & Partial<TransactionRow>
export type WorkerProfileInsert  = Pick<WorkerProfileRow, 'user_id' | 'headline' | 'hourly_rate_usd_cents'> & Partial<WorkerProfileRow>
export type TrustDepositInsert   = Pick<TrustDepositRow, 'user_id'> & Partial<TrustDepositRow>

// ── Database type (Supabase client generic) ───────────────────────────────────

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      listing_category:  ListingCategory
      listing_status:    ListingStatus
      pricing_type:      PricingType
      license_type:      LicenseType
      waitlist_user_type: WaitlistUserType
    }
    Tables: {
      users: {
        Row:           UserRow
        Insert:        UserInsert
        Update:        Partial<UserRow>
        Relationships: []
      }
      agents: {
        Row:           AgentRow
        Insert:        AgentInsert
        Update:        Partial<AgentRow>
        Relationships: []
      }
      listings: {
        Row:           ListingRow
        Insert:        ListingInsert
        Update:        Partial<ListingRow>
        Relationships: []
      }
      listing_jobs: {
        Row:           ListingJobRow
        Insert:        ListingJobInsert
        Update:        Partial<ListingJobRow>
        Relationships: []
      }
      listing_gigs: {
        Row:           ListingGigRow
        Insert:        ListingGigInsert
        Update:        Partial<ListingGigRow>
        Relationships: []
      }
      listing_services: {
        Row:           ListingServiceRow
        Insert:        ListingServiceInsert
        Update:        Partial<ListingServiceRow>
        Relationships: []
      }
      listing_goods: {
        Row:           ListingGoodRow
        Insert:        ListingGoodInsert
        Update:        Partial<ListingGoodRow>
        Relationships: []
      }
      waitlist: {
        Row:           WaitlistRow
        Insert:        WaitlistInsert
        Update:        Partial<WaitlistRow>
        Relationships: []
      }
      lightning_invoices: {
        Row:           LightningInvoiceRow
        Insert:        LightningInvoiceInsert
        Update:        Partial<LightningInvoiceRow>
        Relationships: []
      }
      escrow_contracts: {
        Row:           EscrowContractRow
        Insert:        EscrowContractInsert
        Update:        Partial<EscrowContractRow>
        Relationships: []
      }
      disputes: {
        Row:           DisputeRow
        Insert:        DisputeInsert
        Update:        Partial<DisputeRow>
        Relationships: []
      }
      transactions: {
        Row:           TransactionRow
        Insert:        TransactionInsert
        Update:        Partial<TransactionRow>
        Relationships: []
      }
      btc_price_cache: {
        Row:           BtcPriceCacheRow
        Insert:        Partial<BtcPriceCacheRow>
        Update:        Partial<BtcPriceCacheRow>
        Relationships: []
      }
      auth_challenges: {
        Row:           AuthChallengeRow
        Insert:        Omit<AuthChallengeRow, 'id' | 'created_at' | 'used'>
        Update:        Partial<AuthChallengeRow>
        Relationships: []
      }
      agent_api_keys: {
        Row:           AgentApiKeyRow
        Insert:        Pick<AgentApiKeyRow, 'agent_id' | 'key_hash' | 'key_prefix'> & Partial<AgentApiKeyRow>
        Update:        Partial<AgentApiKeyRow>
        Relationships: []
      }
      worker_profiles: {
        Row:           WorkerProfileRow
        Insert:        WorkerProfileInsert
        Update:        Partial<WorkerProfileRow>
        Relationships: []
      }
      trust_deposits: {
        Row:           TrustDepositRow
        Insert:        TrustDepositInsert
        Update:        Partial<TrustDepositRow>
        Relationships: []
      }
    }
  }
}

// ── Composite types ───────────────────────────────────────────────────────────

export type ListingWithDetail = ListingRow & {
  job?:     ListingJobRow
  gig?:     ListingGigRow
  service?: ListingServiceRow
  good?:    ListingGoodRow
  creator_user?:  Pick<UserRow, 'id' | 'name' | 'avatar_url' | 'rating'> | null
  creator_agent?: Pick<AgentRow, 'id' | 'btc_wallet_address' | 'name' | 'reputation_score'> | null
}

export type EscrowWithListing = EscrowContractRow & {
  listing?: Pick<ListingRow, 'id' | 'title' | 'category' | 'price_sats'>
}

export type WorkerProfileWithUser = WorkerProfileRow & {
  user?: Pick<UserRow, 'id' | 'name' | 'avatar_url' | 'rating'> | null
}
