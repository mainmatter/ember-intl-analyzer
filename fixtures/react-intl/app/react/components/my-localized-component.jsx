import { FormattedMessage, useIntl } from 'react-intl';

export function MyLocalizedComponent() {
  const intl = useIntl();
  const { formatMessage } = intl;

  return (
    <div>
      {formatMessage({ id: 'hook-translation-destructured' })}
      {intl.formatMessage({ id: 'hook-translation-new' })}
      {intl.formatMessage({ id: true ? 'hook-alternate' : 'hook-consequent' })}
      <FormattedMessage id="jsx-translation" />
      <FormattedHTMLMessage id="jsx-translation-html" />
    </div>
  );
}
