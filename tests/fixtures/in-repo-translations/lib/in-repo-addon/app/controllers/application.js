import Controller from '@ember/controller';

export default class ApplicationController extends Controller {
  get foo() {
    return this.intl.t('in-repo-addon.app.js-translation');
  }
}
