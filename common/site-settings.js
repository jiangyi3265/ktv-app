import { reactive } from 'vue';
import { request } from './api';

// Public availability must be checked before rendering any staff login form.
export const siteSettings = reactive({ ready: false, staffPortalEnabled: false, error: '' });
let pending;
export function refreshSiteSettings() {
  if (pending) return pending;
  pending = request('/site-settings').then(value => {
    if (typeof value.staffPortalEnabled !== 'boolean') throw new Error('门店配置暂不可用');
    siteSettings.staffPortalEnabled = value.staffPortalEnabled;
    siteSettings.ready = true;
    siteSettings.error = '';
  }).catch(error => {
    siteSettings.ready = false;
    siteSettings.staffPortalEnabled = false;
    siteSettings.error = error.message || '连接失败，请重试';
  }).finally(() => { pending = null; });
  return pending;
}
