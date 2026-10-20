import { watch } from "vue";
import { onShow, onHide, onUnload } from "@dcloudio/uni-app";
import { DESIGN_MODE, setOrderFilter } from "./store";

// Only the visible page owns the shared query; cached uni-app pages must not override it.
export function useOrderFilter(role, value) {
	let visible = false,
		timer;
	const apply = () => {
		clearTimeout(timer);
		if (!DESIGN_MODE && visible)
			setOrderFilter(role, value() || {}).catch((e) =>
				uni.showToast({ title: e.message, icon: "none" }),
			);
	};
	onShow(() => {
		visible = true;
		apply();
	});
	const hide = () => {
		visible = false;
		clearTimeout(timer);
	};
	onHide(hide);
	onUnload(hide);
	watch(
		value,
		() => {
			clearTimeout(timer);
			if (visible) timer = setTimeout(apply, 250);
		},
		{ deep: true },
	);
}
