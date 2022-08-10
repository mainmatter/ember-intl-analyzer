import Controller from '@ember/controller';

export default class ApplicationController extends Controller {
  foo() {
    return this.intl.t('only-nl-translation');
  }
}
