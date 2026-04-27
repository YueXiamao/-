function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || 'Destination';
}

function formatDay(startDate, offset) {
  const [yearText, monthText, dayText] = startDate.split('-');
  const current = new Date(Date.UTC(
    Number.parseInt(yearText, 10),
    Number.parseInt(monthText, 10) - 1,
    Number.parseInt(dayText, 10) + offset
  ));

  return current.toISOString().slice(0, 10);
}

export class FallbackTemplateProvider {
  provide(request, context = {}) {
    const warnings = ['template_fallback'];

    if (context.reason) {
      warnings.unshift(context.reason);
    }

    return {
      itinerary: Array.from({ length: request.days }, (_, index) => {
        const destinationName = getDestinationName(request, index);

        return {
          day: index + 1,
          date: formatDay(request.start_date, index),
          items: [
            {
              type: 'spot',
              name: `${destinationName} day plan`,
              address: destinationName,
              duration: '2-3h',
              description: 'A balanced sightseeing stop to anchor the day plan.',
              transport_to_next: 'Arrange a convenient local transfer'
            },
            {
              type: 'food',
              name: `${destinationName} meal plan`,
              address: destinationName,
              budget: 'Flexible',
              recommend: 'Pick a dependable local option near the day route'
            },
            {
              type: 'hotel',
              name: `${destinationName} overnight stay`,
              address: destinationName,
              budget: 'To confirm',
              reason: 'Choose a comfortable stay with easy access to the main route'
            }
          ]
        };
      }),
      warnings
    };
  }
}
