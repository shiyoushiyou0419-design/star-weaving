// V6 云端连接设置：请只填写 Supabase 的 Project URL 和 Publishable key。
// 密钥规则：sb_publishable_... 可以放在静态网页中；sb_secret_... / service_role 严禁放在这里。
// 配置留空时，网页可继续使用本地绘制和 JSON 备份，不影响三维场景。
window.WEAVE_CONFIG = {
  supabaseUrl: 'https://vjlxyqziivhhdrlszyxo.supabase.co',                 // 示例：'https://abcdefgh.supabase.co'
  supabasePublishableKey: 'sb_publishable_1OPkZ3j_4AOj58u5qSztsg_XS3PVIBj',      // 示例：'sb_publishable_....'，不是 secret key
  galleryModelUrl: '',            // 可选：'./models/gallery.glb'
  installationModelUrl: ''        // 可选：'./models/installation.glb'
};
