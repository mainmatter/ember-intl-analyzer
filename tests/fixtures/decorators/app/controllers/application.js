import Controller from '@ember/controller';

export default class extends Controller {
  @computed('intl.locale')
  get foo() {
    return this.intl.t('js-translation');
  }
}
