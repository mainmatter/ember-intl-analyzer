import { FormattedMessage, useIntl } from 'react-intl';

export function MyLocalizedComponent() {
  const intl = useIntl();

  return (
    <div>
      {intl.formatMessage({ id: 'hook-translation-new' })}
      {intl.formatMessage({ id: true ? 'hook-alternate' : 'hook-consequent' })}
      <FormattedMessage id="jsx-translation" />
    </div>
  );
}
