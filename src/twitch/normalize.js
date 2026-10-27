// Convert raw EventSub notification payloads into KEYFRAME's small internal event vocabulary.
export function normalize(type, e) {
  switch (type) {
    case 'channel.chat.message':
      return {
        type: 'chat', user: e.chatter_user_name, text: e.message?.text ?? '', color: e.color || null,
        isSub: (e.badges || []).some((b) => b.set_id === 'subscriber' || b.set_id === 'founder'),
        isMod: (e.badges || []).some((b) => b.set_id === 'moderator' || b.set_id === 'broadcaster'),
      };
    case 'channel.follow': return { type: 'follow', user: e.user_name };
    case 'channel.subscribe': return e.is_gift ? null : { type: 'sub', user: e.user_name, tier: Number(e.tier) / 1000 || 1 };
    case 'channel.subscription.message': return { type: 'sub', user: e.user_name, tier: Number(e.tier) / 1000 || 1, months: e.cumulative_months };
    case 'channel.subscription.gift': return { type: 'gift', user: e.is_anonymous ? 'Anonymous' : e.user_name, total: e.total };
    case 'channel.cheer': return { type: 'cheer', user: e.is_anonymous ? 'Anonymous' : e.user_name, bits: e.bits };
    case 'channel.raid': return { type: 'raid', user: e.from_broadcaster_user_name, viewers: e.viewers };
    case 'channel.hype_train.begin': return { type: 'hype', level: e.level ?? 1 };
    case 'channel.hype_train.progress': return { type: 'hype', level: e.level ?? 1 };
    case 'channel.channel_points_custom_reward_redemption.add':
      return { type: 'redeem', user: e.user_name, reward: e.reward?.title ?? '', input: e.user_input ?? '' };
    default: return null;
  }
}

/** Subscriptions we create. `cond(ids)` builds the condition for a given broadcaster/user id. */
export const SUBSCRIPTIONS = [
  { type: 'channel.chat.message', version: '1', scopes: ['user:read:chat'], cond: (b) => ({ broadcaster_user_id: b, user_id: b }) },
  { type: 'channel.follow', version: '2', scopes: ['moderator:read:followers'], cond: (b) => ({ broadcaster_user_id: b, moderator_user_id: b }) },
  { type: 'channel.subscribe', version: '1', scopes: ['channel:read:subscriptions'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.subscription.message', version: '1', scopes: ['channel:read:subscriptions'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.subscription.gift', version: '1', scopes: ['channel:read:subscriptions'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.cheer', version: '1', scopes: ['bits:read'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.raid', version: '1', scopes: [], cond: (b) => ({ to_broadcaster_user_id: b }) },
  { type: 'channel.hype_train.begin', version: '2', scopes: ['channel:read:hype_train'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.hype_train.progress', version: '2', scopes: ['channel:read:hype_train'], cond: (b) => ({ broadcaster_user_id: b }) },
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', scopes: ['channel:read:redemptions'], cond: (b) => ({ broadcaster_user_id: b }) },
];
export const ALL_SCOPES = [...new Set(SUBSCRIPTIONS.flatMap((s) => s.scopes))];
