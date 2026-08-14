import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeferredRevenueWaterfallComponent } from './deferred-revenue-waterfall.component';

@NgModule({
    declarations: [
        DeferredRevenueWaterfallComponent,
    ],
    imports: [
        CommonModule,
    ],
    exports: [
        DeferredRevenueWaterfallComponent,
    ],
})
export class DeferredRevenueWaterfallModule {}
