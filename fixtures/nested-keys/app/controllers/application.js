import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class ApplicationController extends Controller {
  @tracked foo;
  foo() {
    return this.intl.t('foo.bar.hello');
  }
}
