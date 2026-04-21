// components/tag-selector/index.js
Component({
  properties: {
    options: { type: Array, value: [] },
    selected: { type: Array, value: [] },
    multiple: { type: Boolean, value: true },
    max: { type: Number, value: 10 }
  },

  methods: {
    onTagTap(e) {
      const { value } = e.currentTarget.dataset;
      let { selected, multiple, max } = this.data;

      if (multiple) {
        if (selected.includes(value)) {
          selected = selected.filter(v => v !== value);
        } else {
          if (selected.length >= max) return;
          selected = [...selected, value];
        }
      } else {
        selected = selected.includes(value) ? [] : [value];
      }

      this.setData({ selected });
      this.triggerEvent('change', { selected });
    }
  }
});
