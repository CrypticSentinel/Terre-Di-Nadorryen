export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface CharacterRecord {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  concept: string | null;
  image_url: string | null;
  custom_fields: CustomField[];
  is_dead: boolean;
  death_description: string | null;
  died_at: string | null;
}

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  session_date: string | null;
  author_id: string;
  author_display_name?: string | null;
}

export interface CampaignMemberRecord {
  id: string;
  user_id: string;
  role: 'narratore' | 'giocatore';
}

export interface ProfileRecord {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}
