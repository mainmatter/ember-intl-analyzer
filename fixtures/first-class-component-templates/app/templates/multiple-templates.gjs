import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export const Bar = <template>
  {{t "hbs-translation3"}}
</template>

export default class Foo extends Component {
  @tracked foo;
  foo() {
    return this.intl.t(true ? 'js-translation3' : 'js-translation4');
  }

  <template>
    {{t (if true "hbs-translation4" "hbs-translation5")}}
  </template>
}
