/* 《你为什么画星星？》V6 云端接口。
   使用 Supabase Auth 匿名账号 + public.weaving_works RLS；不要使用 secret/service_role key。 */
const TABLE = 'weaving_works';

export function isCloudConfigured(config) {
  const url = String(config.supabaseUrl || '').trim();
  const key = String(config.supabasePublishableKey || '').trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 25 && !key.includes('填入');
}

export async function connectCloud(config, notifyChanged, notifyConnection) {
  if (!isCloudConfigured(config)) return null;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const client = createClient(String(config.supabaseUrl).replace(/\/$/, ''), config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  let { data: sessionData, error: sessionErr } = await client.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!sessionData?.session) {
    const { error: anonErr } = await client.auth.signInAnonymously();
    if (anonErr) throw Error(`匿名访问未启用或登录失败：${anonErr.message}`);
  }
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData?.user?.id) throw Error(`无法确认访客身份：${userErr?.message || '无用户信息'}`);
  const userId = userData.user.id;

  let refreshTimer = null;
  const enqueueRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => notifyChanged(), 400);
  };
  const channel = client.channel('yuzhenli-weaving-v6')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, enqueueRefresh)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') notifyConnection('realtime');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notifyConnection('polling');
    });
  // WebSocket 被网络屏蔽时也能同步，延迟最多约 30 秒。
  const interval = setInterval(() => {
    if (document.visibilityState !== 'hidden') enqueueRefresh();
  }, 30000);

  async function list() {
    const { data, error } = await client.from(TABLE)
      .select('id,owner_id,strokes,transform,created_at,updated_at')
      .order('created_at', { ascending: false }).limit(350);
    if (error) throw error;
    return (data || []).reverse();
  }
  async function save(work, exists) {
    if (exists) {
      const { data, error } = await client.from(TABLE)
        .update({ strokes: work.strokes, transform: work.transform })
        .eq('id', work.id).eq('owner_id', userId).select('id');
      if (error) throw error;
      if (!data?.length) throw Error('没有修改权限，或云端找不到这件作品。');
    } else {
      const { data, error } = await client.from(TABLE)
        .insert({ id: work.id, owner_id: userId, strokes: work.strokes, transform: work.transform }).select('id');
      if (error) throw error;
      if (!data?.length) throw Error('插入作品后未收到确认。');
    }
  }
  async function remove(id) {
    const { data, error } = await client.from(TABLE)
      .delete().eq('id', id).eq('owner_id', userId).select('id');
    if (error) throw error;
    if (!data?.length) throw Error('无法删除：这件作品不存在，或不属于当前访客。');
  }
  function disconnect() {
    clearInterval(interval); clearTimeout(refreshTimer); client.removeChannel(channel);
  }
  return { userId, list, save, remove, disconnect };
}
