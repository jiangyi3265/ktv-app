<script>
import {
	state,
	DESIGN_MODE,
	connection,
	activate,
	pauseSync,
} from "./common/store";
export default {
	onShow() {
		state.foreground = true;
		if (!DESIGN_MODE && connection.role) activate(connection.role);
	},
	onHide() {
		state.foreground = false;
		if (!DESIGN_MODE) pauseSync();
	},
};
</script>
<style>
@import "./styles/font.css";
@import "./styles/theme.css";
@import "./styles/pages.css";
@import "./styles/reference.css";
</style>
