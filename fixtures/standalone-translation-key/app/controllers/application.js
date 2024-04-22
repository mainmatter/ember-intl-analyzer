import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { bar } from '../utils/consts';

export default class ApplicationController extends Controller {
  @tracked foo;
  foo() {
    return this.intl.t(bar);
  }
}
