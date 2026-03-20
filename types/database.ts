export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ListingCategory = 'job' | 'gig' | 'service' | 'good'
export type ListingStatus   = 'open' | 'claimed' | 'completed' | 'disputed'
export type PricingType     = 'hourly' | 'fixed'
export type LicenseType     = 'personal' | 'commercial' | 'exclusive'
export type WaitlistUserType = 'human' | 'agent_builder'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'usd_balance_cents' | 'skills' | 'rating' | 'completed_task_count' | 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      agents: {
        Row: {
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
        Insert: Pick<Database['public']['Tables']['agents']['Row'], 'btc_wallet_address' | 'name' | 'owner_id'> & Partial<Database['public']['Tables']['agents']['Row']>
        Update: Partial<Database['public']['Tables']['agents']['Row']>
      }
      listings: {
        Row: {
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
        Insert: Pick<Database['public']['Tables']['listings']['Row'], 'title' | 'description' | 'price_sats' | 'category'> & Partial<Database['public']['Tables']['listings']['Row']>
        Update: Partial<Database['public']['Tables']['listings']['Row']>
      }
      listing_jobs: {
        Row: {
          listing_id:               string
          deadline:                 string | null
          required_skills:          string[]
          deliverable_description:  string | null
          milestone_flag:           boolean
        }
        Insert: Pick<Database['public']['Tables']['listing_jobs']['Row'], 'listing_id'> & Partial<Database['public']['Tables']['listing_jobs']['Row']>
        Update: Partial<Database['public']['Tables']['listing_jobs']['Row']>
      }
      listing_gigs: {
        Row: {
          listing_id:                 string
          delivery_time_hours:        number | null
          revision_count:             number
          recurring:                  boolean
          turnaround_guarantee_hours: number | null
        }
        Insert: Pick<Database['public']['Tables']['listing_gigs']['Row'], 'listing_id'> & Partial<Database['public']['Tables']['listing_gigs']['Row']>
        Update: Partial<Database['public']['Tables']['listing_gigs']['Row']>
      }
      listing_services: {
        Row: {
          listing_id:               string
          pricing_type:             PricingType
          availability_text:        string | null
          minimum_engagement:       string | null
          response_time_sla_hours:  number | null
        }
        Insert: Pick<Database['public']['Tables']['listing_services']['Row'], 'listing_id' | 'pricing_type'> & Partial<Database['public']['Tables']['listing_services']['Row']>
        Update: Partial<Database['public']['Tables']['listing_services']['Row']>
      }
      listing_goods: {
        Row: {
          listing_id:         string
          file_type:          string | null
          license_type:       LicenseType
          instant_delivery:   boolean
          preview_available:  boolean
        }
        Insert: Pick<Database['public']['Tables']['listing_goods']['Row'], 'listing_id' | 'license_type'> & Partial<Database['public']['Tables']['listing_goods']['Row']>
        Update: Partial<Database['public']['Tables']['listing_goods']['Row']>
      }
      waitlist: {
        Row: {
          id:             string
          email:          string
          user_type:      WaitlistUserType
          referral_code:  string
          referred_by:    string | null
          position:       number | null
          created_at:     string
        }
        Insert: Pick<Database['public']['Tables']['waitlist']['Row'], 'email' | 'user_type' | 'referral_code'> & Partial<Database['public']['Tables']['waitlist']['Row']>
        Update: Partial<Database['public']['Tables']['waitlist']['Row']>
      }
    }
  }
}

// Convenience aliases
export type UserRow        = Database['public']['Tables']['users']['Row']
export type AgentRow       = Database['public']['Tables']['agents']['Row']
export type ListingRow     = Database['public']['Tables']['listings']['Row']
export type ListingJobRow  = Database['public']['Tables']['listing_jobs']['Row']
export type ListingGigRow  = Database['public']['Tables']['listing_gigs']['Row']
export type ListingServiceRow = Database['public']['Tables']['listing_services']['Row']
export type ListingGoodRow = Database['public']['Tables']['listing_goods']['Row']
export type WaitlistRow    = Database['public']['Tables']['waitlist']['Row']

// Listing with detail joined
export type ListingWithDetail = ListingRow & {
  job?:     ListingJobRow
  gig?:     ListingGigRow
  service?: ListingServiceRow
  good?:    ListingGoodRow
  creator_user?:  Pick<UserRow, 'id' | 'name' | 'avatar_url' | 'rating'> | null
  creator_agent?: Pick<AgentRow, 'id' | 'btc_wallet_address' | 'name' | 'reputation_score'> | null
}
