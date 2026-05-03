import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CampaignMemberRecord,
  CharacterRecord,
  NoteRecord,
  ProfileRecord,
} from './types';

interface UseCharacterDetailDataOptions {
  characterId?: string;
  enabled?: boolean;
}

export function useCharacterDetailData({
  characterId,
  enabled = true,
}: UseCharacterDetailDataOptions) {
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [members, setMembers] = useState<CampaignMemberRecord[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<ProfileRecord | null>(null);
  const [assignableProfiles, setAssignableProfiles] = useState<ProfileRecord[]>([]);
  const [rulesetName, setRulesetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled || !characterId) return;
    setLoading(true);

    const [characterRes, notesRes] = await Promise.all([
      supabase.from('characters').select('*').eq('id', characterId).maybeSingle(),
      supabase
        .from('session_notes')
        .select('*')
        .eq('character_id', characterId)
        .order('session_date', { ascending: false }),
    ]);

    if (characterRes.error || !characterRes.data) {
      toast.error(characterRes.error?.message ?? 'Scheda non trovata');
      setCharacter(null);
      setNotes([]);
      setMembers([]);
      setOwnerProfile(null);
      setRulesetName(null);
      setLoading(false);
      return;
    }

    const normalizedCharacter = {
      ...characterRes.data,
      custom_fields: Array.isArray(characterRes.data.custom_fields)
        ? characterRes.data.custom_fields
        : [],
    } as CharacterRecord;

    setCharacter(normalizedCharacter);
    setNotes((notesRes.data ?? []) as NoteRecord[]);

    const [membersRes, ownerRes, campaignRes, profilesRes] = await Promise.all([
      supabase
        .from('campaign_members')
        .select('id, user_id, role')
        .eq('campaign_id', normalizedCharacter.campaign_id),
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', normalizedCharacter.owner_id)
        .maybeSingle(),
      supabase
        .from('campaigns')
        .select('rulesets(name)')
        .eq('id', normalizedCharacter.campaign_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('approval_status', 'approved')
        .order('display_name', { ascending: true }),
    ]);

    setMembers((membersRes.data ?? []) as CampaignMemberRecord[]);
    setOwnerProfile((ownerRes.data as ProfileRecord | null) ?? null);
    setRulesetName((campaignRes.data as any)?.rulesets?.name ?? null);
    setAssignableProfiles((profilesRes.data ?? []) as ProfileRecord[]);
    setLoading(false);
  }, [characterId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const narratorMember = useMemo(
    () => members.find((member) => member.role === 'narratore') ?? null,
    [members]
  );

  const ownerOptions = useMemo(() => {
    if (!character) return [] as ProfileRecord[];
    const exists = assignableProfiles.some((profile) => profile.id === character.owner_id);
    if (exists) return assignableProfiles;
    return ownerProfile ? [ownerProfile, ...assignableProfiles] : assignableProfiles;
  }, [assignableProfiles, character, ownerProfile]);

  return {
    character,
    notes,
    members,
    ownerProfile,
    assignableProfiles: ownerOptions,
    narratorMember,
    rulesetName,
    loading,
    reload: load,
    setCharacter,
    setNotes,
  };
}
