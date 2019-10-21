import roundTo from 'round-to';
import {translate} from './translate';

const t = translate('swap');

export default function	formatSwap(data) {
	// Console.log('swap data', data);
	const {
		uuid,
		timeStarted,
		request,
		response,
		swapData,
	} = data;

	const {
		action,
		base: baseCurrency,
		rel: quoteCurrency,
		baseAmount,
		quoteAmount,
	} = response;

	const swap = {
		uuid,
		timeStarted,
		orderType: action === 'Buy' ? 'buy' : 'sell',
		status: 'pending',
		statusFormatted: t('status.open').toLowerCase(),
		get isActive() {
			return !['completed', 'failed'].includes(this.status);
		},
		error: false,
		progress: 0,
		baseCurrency,
		quoteCurrency,
		baseCurrencyAmount: roundTo(baseAmount, 8),
		quoteCurrencyAmount: roundTo(quoteAmount, 8),
		price: roundTo(quoteAmount / baseAmount, 8),
		requested: {
			baseCurrencyAmount: roundTo(request.amount, 8),
			quoteCurrencyAmount: roundTo(request.total, 8),
			price: roundTo(request.price, 8),
		},
		broadcast: {
			baseCurrencyAmount: roundTo(baseAmount, 8),
			quoteCurrencyAmount: roundTo(quoteAmount, 8),
			price: roundTo(quoteAmount / baseAmount, 8),
		},
		executed: {
			baseCurrencyAmount: undefined,
			quoteCurrencyAmount: undefined,
			price: undefined,
			percentCheaperThanRequested: undefined,
		},
		totalStages: [],
		stages: [],
		_debug: {
			request,
			response,
			swapData,
		},
	};

	// Console.log('swapData', swapData);

	if (swapData) {
		const {
			events,
			error_events: errorEvents,
			success_events: successEvents,
		} = swapData;

		// Console.log('events', events);

		const failedEvent = events.find(event => errorEvents.includes(event.event.type));
		const nonSwapEvents = ['Started', 'Negotiated', 'Finished'];
		const totalSwapEvents = successEvents.filter(type => !nonSwapEvents.includes(type));
		const swapEvents = events.filter(event => (
			!nonSwapEvents.includes(event.event.type) &&
			!errorEvents.includes(event.event.type)
		));
		const isFinished = !failedEvent && events.some(event => event.event.type === 'Finished');
		const isSwapping = !failedEvent && !isFinished && swapEvents.length > 0;
		const maxSwapProgress = 0.8;
		const newestEvent = events[events.length - 1];

		// Console.log('failedEvent', failedEvent);
		// console.log('totalSwapEvents', totalSwapEvents);
		// console.log('swapEvents', swapEvents);
		// console.log('isFinished', isFinished);
		// console.log('isSwapping', isSwapping);

		swap.totalStages = totalSwapEvents;
		swap.stages = swapEvents;

		if (failedEvent) {
			swap.status = 'failed';
			swap.progress = 1;

			swap.error = {
				code: failedEvent.event.type,
				message: failedEvent.event.data.error,
			};
		} else if (isFinished) {
			swap.status = 'completed';
			swap.progress = 1;
		} else if (isSwapping) {
			swap.status = 'swapping';
			swap.statusFormatted = `swap ${swapEvents.length}/${totalSwapEvents.length}`;
			swap.progress = 0.1 + ((swapEvents.length / totalSwapEvents.length) * maxSwapProgress);
		} else if (newestEvent && newestEvent.event.type === 'Negotiated') {
			swap.status = 'matched';
			swap.progress = 0.1;
		}

		// TODO(sindresorhus): I've tried to preserve the existing behavior when using mm2. We should probably update the events and naming for mm2 conventions though.

		if (!isSwapping) {
			swap.statusFormatted = t(`status.${swap.status}`).toLowerCase();
		}
	}

	if (swap.status === 'pending') {
		swap.statusFormatted = t('status.open').toLowerCase();
	}

	// Show open orders from previous session as cancelled
	const cancelled = swap.status === 'pending' && isAfter(appTimeStarted, swap.timeStarted);
	if (cancelled) {
		swap.status = 'failed';
		swap.error = {
			code: undefined,
			message: undefined,
		};
		swap.statusFormatted = t('status.cancelled').toLowerCase();
	}

	// Console.log('progress', swap.progress);

	return swap;
}
