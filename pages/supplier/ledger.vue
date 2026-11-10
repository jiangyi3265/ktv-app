<template>
  <AppShell page="23" title="收款记录" account-role="supplier" back-to="09">
    <view class="page-body ledger-page">
      <view class="ledger-intro"><text class="ledger-heading">我的餐费账单</text><text class="muted small">款项由 KTV 统一收取，本页用于核对当前分配订单的餐费。</text></view>
      <view class="ledger-dates"><picker mode="date" :value="from" @change="from=$event.detail.value"><view class="ledger-date">{{ from }}</view></picker><text>至</text><picker mode="date" :value="to" @change="to=$event.detail.value"><view class="ledger-date">{{ to }}</view></picker><button class="text-button" :disabled="loading" @click="query">查询</button></view>
      <view class="ledger-kinds"><button v-for="item in kinds" :key="item.value" :class="{selected:kind===item.value}" @click="kind=item.value;query()">{{ item.label }}</button></view>
      <view v-if="error" class="ledger-error"><text>{{ error }}</text><button class="text-button" @click="load">重试</button></view>
      <view class="card ledger-summary"><view><text class="muted small">顾客实付</text><text class="ledger-amount">¥{{ money(data.receiptCents) }}</text></view><view><text class="muted small">成功退款</text><text class="ledger-amount">¥{{ money(data.refundCents) }}</text></view><view class="ledger-net"><text>净收款</text><text>¥{{ money(data.netCents) }}</text></view></view>
      <view class="between ledger-list-heading"><text>收支明细 · {{ data.total }} 笔</text><button class="text-button" :disabled="loading" @click="load">{{ loading?'加载中…':'刷新' }}</button></view>
      <text class="ledger-caption">北京时间；净收款不代表已结算给食堂。</text>
      <view v-for="entry in data.entries" :key="entry.id" class="card ledger-row"><view class="between"><text class="bold">{{ entry.room }} 包厢</text><text :class="entry.kind==='receipt'?'text-green':'ledger-refund'">{{ entry.amountCents>0?'+':'' }}¥{{ money(entry.amountCents) }}</text></view><view class="between small"><text>{{ entry.kind==='receipt'?'顾客付款':'成功退款' }}</text><text class="muted">订单 {{ entry.orderId }}</text></view><text class="muted small">{{ entry.occurredAt.replace('T',' ').slice(0,19) }}{{ entry.timeSource==='recorded'?'（补录时间）':'' }}</text></view>
      <view v-if="!loading&&!error&&!data.entries.length" class="card empty-state"><AppIcon name="receipt" color="gray" :size="32"/><text>这个时段暂无收款记录</text><text class="muted small">顾客实际付款或退款成功后会显示在这里</text></view>
      <view v-if="data.total>50" class="ledger-pagination"><button :disabled="page<=1||loading" @click="page--;load()">上一页</button><text>第 {{ page }} 页</text><button :disabled="page*50>=data.total||loading" @click="page++;load()">下一页</button></view>
    </view>
  </AppShell>
</template>
<script setup>
import {ref,reactive,watch,provide} from 'vue';
import {onShow,onHide,onUnload} from '@dcloudio/uni-app';
import AppShell from '../../components/AppShell.vue';
import AppIcon from '../../components/AppIcon.vue';
import {connection,state,supplierLedger} from '../../common/store';
provide('artboard',3);
const now=new Date(Date.now()+8*3600000),today=now.toISOString().slice(0,10);
const from=ref(today.slice(0,7)+'-01'),to=ref(today),kind=ref(''),page=ref(1),loading=ref(false),error=ref('');
const kinds=[{value:'',label:'全部'},{value:'receipt',label:'顾客付款'},{value:'refund',label:'成功退款'}];
const empty=()=>({entries:[],total:0,receiptCents:0,refundCents:0,netCents:0});
const data=reactive(empty()),money=c=>(Number(c||0)/100).toFixed(2);
let visible=false,sequence=0,timer;
async function load(){if(!visible||!connection.ready||connection.role!=='supplier')return;const epoch=++sequence;loading.value=true;error.value='';try{const result=await supplierLedger({from:from.value,to:to.value,kind:kind.value,page:page.value});if(epoch===sequence)Object.assign(data,result);}catch(e){if(epoch===sequence){error.value=e.message;Object.assign(data,empty());}}finally{if(epoch===sequence)loading.value=false;}}
function query(){page.value=1;load();}
watch(()=>[connection.ready,connection.role,state.supplierId],()=>{sequence++;Object.assign(data,empty());load();});
onShow(()=>{visible=true;load();clearInterval(timer);timer=setInterval(()=>{if(!loading.value)load();},30000);});
function hide(){visible=false;sequence++;loading.value=false;clearInterval(timer);}
onHide(hide);onUnload(hide);
</script>
<style scoped>
.ledger-page{padding:18px 16px}.ledger-intro{display:flex;flex-direction:column;gap:9px;margin:4px 0 22px}.ledger-heading{font-size:23px;font-weight:700}.ledger-intro .small{line-height:1.7}.ledger-dates{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:13px;margin-bottom:16px}.ledger-date{padding:9px 7px;border:1px solid var(--line);border-radius:8px;background:var(--surface,#faf9f6)}.ledger-kinds{display:flex;gap:12px;margin-bottom:16px}.ledger-kinds button{padding:8px 12px;font-size:13px;color:var(--muted,#667177);border-radius:20px}.ledger-kinds .selected{background:#e6f2eb;color:#28785e}.ledger-summary{display:flex;flex-wrap:wrap;gap:22px;padding:20px}.ledger-summary>view{display:flex;flex-direction:column;gap:9px;flex:1}.ledger-summary .ledger-net{flex-direction:row;flex-basis:100%;justify-content:space-between;padding-top:16px;border-top:1px solid var(--line);font-weight:700}.ledger-amount{font-size:23px;font-weight:600}.ledger-list-heading{margin:24px 0 7px;font-size:15px;font-weight:600}.ledger-caption{display:block;color:#667177;font-size:12px;margin-bottom:14px}.ledger-row{display:flex;flex-direction:column;gap:12px;padding:17px;margin-bottom:12px}.ledger-refund{color:#b66a27}.ledger-error{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#af4d35;font-size:13px;margin-bottom:12px}.ledger-pagination{display:flex;justify-content:space-between;align-items:center;margin:22px 0;font-size:14px}.ledger-pagination button{padding:10px;color:#28785e}
</style>
