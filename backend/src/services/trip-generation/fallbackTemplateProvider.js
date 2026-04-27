function getDestinationName(request, index) {
  const destination = request.destinations[index % request.destinations.length];
  return typeof destination === 'string' ? destination : destination?.name || '目的地';
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
              name: `${destinationName}参考游玩点`,
              address: destinationName,
              duration: '2-3h',
              description: '先安排一个节奏适中的游玩点，作为当天路线的基础锚点。',
              transport_to_next: '建议选择方便的本地交通前往下一站'
            },
            {
              type: 'food',
              name: `${destinationName}用餐建议`,
              address: destinationName,
              budget: '按实际消费确认',
              recommend: '优先选择当天路线附近评价稳定的本地餐饮'
            },
            {
              type: 'hotel',
              name: `${destinationName}住宿建议`,
              address: destinationName,
              budget: '待确认',
              reason: '建议选择交通方便、便于衔接主要路线的住宿'
            }
          ]
        };
      }),
      warnings
    };
  }
}
