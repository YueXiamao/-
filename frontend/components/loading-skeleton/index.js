// components/loading-skeleton/index.js
Component({
  properties: {
    type: {
      type: String,
      value: 'card' // 'card' | 'list' | 'detail'
    },
    count: {
      type: Number,
      value: 1
    }
  }
});
