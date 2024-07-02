import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import SwitchDarkMode from './SwitchDarkMode';
import SelectLanguage from './SelectLanguage';

function App() {
  useEffect(() => {
    postMessage({ payload: 'removeLoading' }, '*');
  });

  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      <div className="flex-auto">
        <div className="ml-4 mr-4 mt-4 mb-4 flex items-center justify-between">
          <SwitchDarkMode />
          <SelectLanguage />
        </div>
        <div className=" flex flex-col justify-center items-center h-full space-y-4">
          <h1 className="text-2xl">Vite + React + Typescript + Electron + Tailwind</h1>
          <h1 className="text-2xl">{t('home.message')}</h1>
        </div>
      </div>
    </div>
  );
}

export default App;
