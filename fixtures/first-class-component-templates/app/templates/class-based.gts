import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class Foo extends Component {
  @tracked foo;
  foo(): string {
    return this.intl.t(true ? 'ts-translation' : 'ts-translation2');
  }

  <template>
    {{t (if true "ts-translation3" "ts-translation4")}}
  </template>
}
