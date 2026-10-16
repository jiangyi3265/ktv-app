import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";

// uni-app keeps visited pages alive. Refresh query options when a page is shown
// again so order IDs and filters cannot remain attached to an earlier visit.
export function usePageQuery() {
	const query = ref({});
	onLoad((options) => {
		query.value = options || {};
	});
	onShow(() => {
		const pages = getCurrentPages();
		const current = pages[pages.length - 1];
		if (current?.options) query.value = { ...current.options };
		// #ifdef H5
		const search = window.location.hash.split("?")[1] || "";
		query.value = Object.fromEntries(new URLSearchParams(search));
		// #endif
	});
	return query;
}
