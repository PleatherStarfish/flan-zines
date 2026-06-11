import { exportCharacterSet, type CharacterExportRequest } from './export';

type WorkerMessage = { id: string; request: CharacterExportRequest };

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const { id, request } = event.data;
	try {
		const files = await exportCharacterSet(request, (done, total) => {
			self.postMessage({ id, type: 'progress', done, total });
		});
		self.postMessage({ id, type: 'done', files });
	} catch (error) {
		self.postMessage({
			id,
			type: 'error',
			message: error instanceof Error ? error.message : 'Character export failed.'
		});
	}
};
