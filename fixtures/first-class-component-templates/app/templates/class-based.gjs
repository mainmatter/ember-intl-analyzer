import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

export default class Foo extends Component {
  @tracked foo;
  foo() {
    return this.intl.t(true ? 'js-translation' : 'js-translation2');
  }

  @action
  doSomething(template) {}

  <template>
    <button type="button" {{on "click" this.doSomething}}>
      {{t (if true "hbs-translation" "hbs-translation2")}}
    </button>
  </template>
}
