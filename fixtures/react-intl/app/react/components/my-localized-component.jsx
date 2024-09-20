import { FormattedMessage, useIntl } from 'react-intl';

export function MyLocalizedComponent() {
  // legacy API
  const { t } = useIntl();

  // new API
  const intl = useIntl();

  return (
    <div>
      {t('hook-translation')}
      {intl.formatMessage({ id: 'hook-translation-new' })}
      {intl.formatMessage({ id: true ? 'hook-alternate' : 'hook-consequent'})}
      <FormattedMessage id="jsx-translation" />
    </div>
  );
}
