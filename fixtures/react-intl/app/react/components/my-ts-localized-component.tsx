import { FormattedMessage } from 'react-intl';

export function MyLocalizedComponent(): JSX.Element {
  return (
    <div>
      <FormattedMessage id="tsx-translation" />
      <FormattedHTMLMessage id="jsx-translation-html" />
    </div>
  );
}
