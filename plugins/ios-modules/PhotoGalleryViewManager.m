//
// 捨てショ - PhotoGalleryViewManager Bridge (ObjC)
//
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(PhotoGalleryViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(assetIds, NSArray)
RCT_EXPORT_VIEW_PROPERTY(currentIndex, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(deleteIds, NSArray)
RCT_EXPORT_VIEW_PROPERTY(skipIds, NSArray)
RCT_EXPORT_VIEW_PROPERTY(currentBadgeText, NSString)
RCT_EXPORT_VIEW_PROPERTY(onSelectIndex, RCTDirectEventBlock)

@end
