import { FormattedMessage, useIntl } from 'react-intl';

export function MyLocalizedComponent() {
  const { t } = useIntl();
  return (
    <div>
      {t('hook-translation')}
      <FormattedMessage id="jsx-translation" />
    </div>
  );
}
