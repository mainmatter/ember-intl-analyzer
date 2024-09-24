import { useIntl } from 'react-intl';

export function useTranslations() {
  const intl = useIntl();
  return {
    'my-custom-translation-key': intl.formatMessage({ id: 'my-custom-hook-translation' }),
  };
}
