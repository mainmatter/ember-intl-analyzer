import Controller from '@ember/controller';

export default Controller.extend({
  foo: computed('intl.locale', function() {
    return this.intl.t('js-translation');
  }),
});
