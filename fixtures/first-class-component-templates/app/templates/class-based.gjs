import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class Foo extends Component {
  @tracked foo;
  foo() {
    return this.intl.t(true ? 'js-translation' : 'js-translation2');
  }

  <template>
    {{t (if true "hbs-translation" "hbs-translation2")}}
  </template>
}
