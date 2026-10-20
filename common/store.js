import * as design from "./design-store";
import * as live from "./live-store";
export const DESIGN_MODE = import.meta.env.VITE_KTV_MODE === "design";
const store = DESIGN_MODE ? design : live;
export const {
	state,
	persist,
	cartItems,
	cartCount,
	cartTotal,
	changeQuantity,
	clearCart,
	orderTotal,
	orderCount,
	activeOrder,
	visibleSupplierOrders,
	updateOrder,
	createUnpaidOrder,
	completeDemoPayment,
	resetDemo,
} = store;
export const { initialProducts, sampleItems } = design;
export const DEMO_MODE = DESIGN_MODE;
export const emptyOrder = live.emptyOrder;
export const {
	connection,
	activate,
	refresh,
	login,
	logout,
	pauseSync,
	saveProduct,
	saveRoom,
	saveAccount,
	saveImage,
	cancelOrder,
	reassignOrder,
	refundOrder,
	rotatePassword,
	roomQR,
	scanRoom,
	payWechat,
	readiness,
	changeOrderPage,
	setOrderFilter,
} = live;
