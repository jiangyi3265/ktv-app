import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { DESIGN_MODE, scanRoom, state, connection, refresh } from "./store";

// uni-app keeps visited pages alive. Refresh query options when a page is shown
// again so order IDs and filters cannot remain attached to an earlier visit.
export function usePageQuery() {
	const query = ref({});
	onLoad((options) => {
		query.value = options || {};
		if (!DESIGN_MODE && options?.id) {
			state.activeOrderId = options.id;
			if (connection.ready) refresh().catch(() => {});
		}
		if (!DESIGN_MODE && options?.scene)
			scanRoom(decodeURIComponent(options.scene)).catch((error) =>
				uni.showToast({ title: error.message, icon: "none" }),
			);
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
