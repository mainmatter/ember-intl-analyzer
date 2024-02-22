import Controller from '@ember/controller';

export default class MyController extends Controller {
  @service intl;

  get myTranslation() {
    const { t } = this.intl;
    return t('js-translation');
  }
}
