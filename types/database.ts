export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ListingCategory = 'job' | 'gig' | 'service' | 'good'
export type ListingStatus   = 'open' | 'claimed' | 'completed' | 'disputed'
export type PricingType     = 'hourly' | 'fixed'
export type LicenseType     = 'personal' | 'commercial' | 'exclusive'
export type WaitlistUserType = 'human' | 'agent_builder'

// ── Row types ────────────────────────────────────────────────────────────────

export type UserRow = {
  id:                   string
  email:                string
  name:                 string | null
  bio:                  string | null
  location:             string | null
  avatar_url:           string | null
  skills:               string[]
  usd_balance_cents:    number
  payout_info:          Json | null
  rating:               number
  completed_task_count: number
  created_at:           string
}

export type AgentRow = {
  id:                   string
  btc_wallet_address:   string
  name:                 string
  description:          string | null
  capabilities:         string[]
  owner_id:             string
  spending_limit_sats:  number
  model_version:        string | null
  reputation_score:     number
  tasks_posted_count:   number
  sats_spent_total:     number
  created_at:           string
}

export type ListingRow = {
  id:                   string
  title:                string
  description:          string
  price_sats:           number
  creator_user_id:      string | null
  creator_agent_id:     string | null
  claimed_by_user_id:   string | null
  claimed_by_agent_id:  string | null
  claimed_at:           string | null
  category:             ListingCategory
  status:               ListingStatus
  tags:                 string[]
  created_at:           string
  updated_at:           string
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

// ── Insert types ─────────────────────────────────────────────────────────────

export type UserInsert = Pick<UserRow, 'id' | 'email'> & Partial<UserRow>
export type AgentInsert = Pick<AgentRow, 'btc_wallet_address' | 'name' | 'owner_id'> & Partial<AgentRow>
export type ListingInsert = Pick<ListingRow, 'title' | 'description' | 'price_sats' | 'category'> & Partial<ListingRow>
export type ListingJobInsert = Pick<ListingJobRow, 'listing_id'> & Partial<ListingJobRow>
export type ListingGigInsert = Pick<ListingGigRow, 'listing_id'> & Partial<ListingGigRow>
export type ListingServiceInsert = Pick<ListingServiceRow, 'listing_id' | 'pricing_type'> & Partial<ListingServiceRow>
export type ListingGoodInsert = Pick<ListingGoodRow, 'listing_id' | 'license_type'> & Partial<ListingGoodRow>
export type WaitlistInsert = Pick<WaitlistRow, 'email' | 'user_type' | 'referral_code'> & Partial<WaitlistRow>

// ── Database type (Supabase client generic) ───────────────────────────────────

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      listing_category: ListingCategory
      listing_status: ListingStatus
      pricing_type: PricingType
      license_type: LicenseType
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
    }
  }
}

// Listing with detail joined
export type ListingWithDetail = ListingRow & {
  job?:     ListingJobRow
  gig?:     ListingGigRow
  service?: ListingServiceRow
  good?:    ListingGoodRow
  creator_user?:  Pick<UserRow, 'id' | 'name' | 'avatar_url' | 'rating'> | null
  creator_agent?: Pick<AgentRow, 'id' | 'btc_wallet_address' | 'name' | 'reputation_score'> | null
}
