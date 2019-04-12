/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import dateMath from '@elastic/datemath';
import { i18n } from '@kbn/i18n';

import { ContextMenuAction, ContextMenuActionsRegistryProvider } from 'ui/embeddable';
import { PanelActionAPI } from 'ui/embeddable/context_menu_actions/types';
import { kfetch } from 'ui/kfetch';
import { toastNotifications } from 'ui/notify';
import chrome from 'ui/chrome';
import { API_BASE_URL_V1 } from '../../common/constants';

const API_BASE_URL = `${API_BASE_URL_V1}/generate/immediate/csv/saved-object`;

class GetCsvReportPanelAction extends ContextMenuAction {
  constructor() {
    super(
      {
        displayName: i18n.translate('xpack.reporting.dashboard.downloadCsvPanelTitle', {
          defaultMessage: 'Download CSV',
        }),
        id: 'downloadCsvReport',
        parentPanelId: 'mainMenu',
      },
      {
        icon: 'document',
      }
    );
  }

  public async generateJobParams({ searchEmbeddable }: { searchEmbeddable: any }) {
    const adapters = searchEmbeddable.getInspectorAdapters();
    if (!adapters) {
      return {};
    }

    if (adapters.requests.requests.length === 0) {
      return {};
    }

    return searchEmbeddable.searchScope.searchSource.getSearchRequestBody();
  }

  public isVisible = (panelActionAPI: PanelActionAPI): boolean => {
    const enablePanelActionDownlad = chrome.getInjected('enablePanelActionDownlad');

    if (!enablePanelActionDownlad) {
      return false;
    }

    const { embeddable, containerState } = panelActionAPI;

    return (
      containerState.viewMode !== 'edit' && !!embeddable && embeddable.hasOwnProperty('savedSearch')
    );
  };

  public onClick = async (panelActionAPI: PanelActionAPI) => {
    const { embeddable } = panelActionAPI as any;
    const {
      timeRange: { from, to },
    } = embeddable;

    if (!embeddable) {
      return;
    }

    const searchEmbeddable = embeddable;
    const state = await this.generateJobParams({ searchEmbeddable });

    const id = `search:${embeddable.savedSearch.id}`;
    const filename = embeddable.getPanelTitle();
    const timezone = chrome.getUiSettingsClient().get('dateFormat:tz');
    const fromTime = dateMath.parse(from);
    const toTime = dateMath.parse(to);

    if (!fromTime || !toTime) {
      return this.onGenerationFail(
        new Error(`Invalid time range: From: ${fromTime}, To: ${toTime}`)
      );
    }

    const body = JSON.stringify({
      timerange: {
        min: fromTime.format(),
        max: toTime.format(),
        timezone,
      },
      state,
    });

    await kfetch({ method: 'POST', pathname: `${API_BASE_URL}/${id}`, body }, { parseJson: false })
      .then(r => r.text())
      .then(csv => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = window.document.createElement('a');
        const downloadObject = window.URL.createObjectURL(blob);
        a.href = downloadObject;
        a.download = `${filename}.csv`;
        a.click();
        window.URL.revokeObjectURL(downloadObject);
      })
      .catch(this.onGenerationFail);
  };

  private onGenerationFail(error: Error) {
    toastNotifications.addDanger({
      title: i18n.translate('xpack.reporting.dashboard.failedCsvDownloadTitle', {
        defaultMessage: `CSV download failed`,
      }),
      text: i18n.translate('xpack.reporting.dashboard.failedCsvDownloadMessage', {
        defaultMessage: `We couldn't download your CSV at this time.`,
      }),
      'data-test-subj': 'downloadCsvFail',
    });
  }
}

ContextMenuActionsRegistryProvider.register(() => new GetCsvReportPanelAction());
