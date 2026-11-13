import { app, uiSignal, useSignal } from '../core/store';

export function Toast() {
  useSignal(uiSignal);
  return <div className="toast" id="toast" role="status" hidden={!app.toast}>{app.toast}</div>;
}
