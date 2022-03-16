import Controller from '@ember/controller';

export default class AddonController extends Controller {
  get foo() {
    return this.intl.t('in-repo-addon.addon.js-translation');
  }
}
