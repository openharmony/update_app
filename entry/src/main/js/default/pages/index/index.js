/*
 * Copyright (c) 2021 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import prompt from '@system.prompt'
import app from '@system.app';
import client from '@ohos.update';

const HAS_NEW_VERSION = 1;
const NO_NEW_VERSION = 0;
const PACKAGE_NAME = "com.hmos.ouc";
const VENDOR = "public";
const TAG = "OUC_DEMO ";
let upgradeInfo = {
    upgradeApp: PACKAGE_NAME,
    businessType: {
        vendor: VENDOR,
        subType: 1
    }
}
let eventClassifyInfo = {
    eventClassify: 0x01000000,
    extraInfo: ""
}
var temp = 0;
let versionDigestInfo;
let pauseDownloadOptions = {
    isAllowAutoResume: false
}
const page = {
    data: {
        title: "当前版本:10.2.1",
        button: "查看更新",
        pageType: "currVersion",
        versionName: "10.2.0",
        size: "20MB",
        journal: "本次更新解决了一些BUG。",
        matter: "请保持50%以上电量",
        showLoad: "",
        width: "5%",
        showBanner: "",
        showButton: "download",
        upgradeInfo: "",
        updater: Object(),
        timer: undefined,
        dialog: "",
        showSimpledialog: ""
    },
    onInit() {
        console.info(TAG + "onInit")
        try {
            page.data.updater = client.getOnlineUpdater(upgradeInfo);
            page.getCurrVersion();
        } catch (error) {
            console.error(TAG + "onInit error: " + JSON.stringify(error));
        }
    },
    onClick: function () {
        if (page.data.pageType == "currVersion") { // 检查更新版本
            page.data.pageType = "checkVersion";
            page.data.button = "取消查看";
            page.data.showLoad = "load";
            page.checkNewVersion();
        } else if (page.data.pageType == "newVersion") { // 当前需要下载最新的版本
            page.data.pageType = "downVersion";
            page.data.showLoad = "load";
            page.data.showBanner = 'banner';
            page.data.button = "暂停下载";
            if (page.data.updater == undefined) {
                page.data.pageType = "errorPage";
                page.data.showButton = 'download';
                page.data.button = '退出';
                page.data.title = "初始化出现错误，退出app";
                return;
            }
            this.download()
        } else if (this.pageType == "lastVersion") { // 已经是最新的版本了，单击后退出页面
            page.data.showLoad = "";
            app.terminate();
        } else if (page.data.pageType == "checkVersion") { // 检查中，取消检查
            page.data.showSimpledialog = "simpledialog";
            this.$element('simpledialog').show();
            page.data.dialog = "是否取消检查";
        } else if (page.data.pageType == "downVersion") { // 下载中，取消下载
            page.data.showSimpledialog = "simpledialog";
            page.data.dialog = "是否暂停下载！";
            this.$element('simpledialog').show();
            temp = 1;
        } else if (page.data.pageType == "errorPage") { // 出错，退出
            app.terminate();
        }
    },
    download() {
        console.info(TAG + "download")
        page.data.updater.on(eventClassifyInfo, eventInfo => {
            console.info(TAG + "download eventInfo: " + JSON.stringify(eventInfo))
            if (page.data.pageType != "downVersion") {
                return;
            }
            let progress = {
                status: eventInfo.taskBody?.status,
                percent: eventInfo.taskBody?.progress,
                endReason: eventInfo.taskBody?.errorMessages?.[0]?.errorCode?.toString()
            }
            let percent = progress.percent;
            if (progress.percent > 5) {
                percent = progress.percent - 5;
            } else if (progress.percent > 90) {
                percent = 90;
            }
            page.data.width = percent + '%';
            if (progress.percent == 100) {
                page.data.showLoad = "";
                page.data.showBanner = '';
                if (temp == 1) {
                    this.$element('simpledialog').close();
                }
            }
            // 下载成功 UpdateState.UPDATE_STATE_DOWNLOAD_SUCCESS
            if (eventInfo.eventId == EventId.EVENT_DOWNLOAD_SUCCESS) {
                page.data.pageType = "downSuccess";
                page.data.showButton = "upgrade";
                page.data.upgradeInfo = page.data.versionName + "安装包下载完成，是否安装？";
            } else if (eventInfo.eventId == EventId.EVENT_DOWNLOAD_FAIL) { // 失败
                page.data.pageType = "errorPage";
                page.data.showButton = 'download';
                page.data.button = '退出';
                page.data.title = "下载失败";
                if (progress.endReason) {
                    page.data.title = "下载失败，失败原因：" + progress.endReason;
                }
            }
        });
        let downloadOptions = {
            allowNetwork: 1,
            order: 1
        }
        page.data.updater.download(versionDigestInfo, downloadOptions).then(result => {
            console.info(TAG + "download result: " + JSON.stringify(result));
        }).catch(err => {
            console.error(TAG + "download err: " + JSON.stringify(err));
        });
    },
    clickInstall: function () {
        if (page.data.pageType == "downSuccess") { // 下载成功，开始升级
            page.upgrade();
        }
    },

    clickCancel: function () {
        if (page.data.pageType == "downSuccess") { // 下载成功，取消升级
            page.data.showSimpledialog = "simpledialog";
            page.data.dialog = "是否稍后安装";
            this.$element('simpledialog').show();
        }
    },

    getCurrVersion() {
        console.info(TAG + "getCurrVersion");
        if (page.data.updater == undefined) {
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "初始化出现错误，退出app";
            return;
        }

        // 获取版本信息
        page.data.updater.getTaskInfo().then(taskInfo => {
            console.info(TAG + "getTaskInfo result: " + JSON.stringify(taskInfo));
            let taskStatus = taskInfo?.taskBody?.status;
            if (taskStatus < 12) {
                this.checkNewVersionLocal();
            } else {
                this.getNewVersionInfoLocal();
            }
        });
    },

    checkNewVersionLocal() {
        page.data.updater.checkNewVersion().then(data => {
            console.info(TAG + "checkNewVersion result: " + JSON.stringify(data));
            if (data.isExistNewVersion == NO_NEW_VERSION) { // 已经最新
                page.data.title = "当前已经是最新版本";
                page.data.button = "确定";
                page.data.pageType = "lastVersion";
                page.data.versionName = data?.newVersionInfo?.versionComponents?.[0]?.displayVersion;
            } else if (data.isExistNewVersion == HAS_NEW_VERSION) {
                page.data.button = "查看更新";
                page.data.pageType = "currVersion";
                page.data.versionName = data?.newVersionInfo?.versionComponents?.[0]?.displayVersion;
            } else {
                page.data.title = "获取新版本失败";
            }
        }).catch(error => {
            console.info(TAG + "checkNewVersion error: " + JSON.stringify(error));
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "检查新版本失败";
            if (error.errorNum) {
                page.data.title = "检查新版本失败，失败原因：" + error.errorNum;
            }
        });
    },

    getNewVersionInfoLocal() {
        page.data.updater.getNewVersionInfo().then(data => {
            console.info(TAG + "getNewVersionInfo result: " + JSON.stringify(data));
            page.data.button = "查看更新";
            page.data.pageType = "currVersion";
            page.data.versionName = data?.versionComponents?.[0]?.displayVersion;
        }).catch(error => {
            console.info(TAG + "getNewVersionInfo error: " + JSON.stringify(error));
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "检查新版本失败";
            if (error.errorNum) {
                page.data.title = "检查新版本失败，失败原因：" + error.errorNum;
            }
        });
    },

    checkNewVersion: function () {
        if (page.data.updater == undefined) {
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "初始化出现错误，退出app";
            return;
        }
        console.info(TAG + "checkNewVersion");
        page.data.updater.getNewVersionInfo().then(info => {
            console.info(TAG + "checkNewVersion getNewVersionInfo: " + JSON.stringify(info));
            versionDigestInfo = info?.versionDigestInfo;
            page.data.showLoad = "";
            let size = info?.versionComponents?.[0]?.size / 1024 / 1024;
            page.data.versionName = info?.versionComponents?.[0]?.displayVersion;
            page.data.size = String(size.toFixed(2)) + "MB";
            if (info?.versionComponents?.[0]?.descriptionInfo?.content != undefined) {
                page.data.journal = info?.versionComponents?.[0]?.descriptionInfo?.content;
            }
            page.data.pageType = "newVersion";
            page.data.button = "下载更新包";
        }).catch(error => {
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "检查新版本失败";
            if (error.errorNum) {
                page.data.title = "检查新版本失败，失败原因：" + error.errorNum;
            }
        });
    },

    upgrade() {
        if (page.data.updater == undefined) {
            page.data.pageType = "errorPage";
            page.data.showButton = 'download';
            page.data.button = '退出';
            page.data.title = "初始化出现错误，退出app";
            return;
        }
        page.data.updater.on(eventClassifyInfo, eventInfo => {
            console.info(TAG + "upgrade eventInfo: " + JSON.stringify(eventInfo));
            let progress = {
                status: eventInfo.taskBody?.status,
                percent: eventInfo.taskBody?.progress,
                endReason: eventInfo.taskBody?.errorMessages?.[0]?.errorCode?.toString()
            }
            page.data.width = progress.percent + '%';
            if (progress.status == EventId.EVENT_UPGRADE_FAIL) { // 失败
                page.data.showLoad = "";
                page.data.pageType = "errorPage";
                page.data.showButton = 'download';
                page.data.button = '退出';
                page.data.title = "升级失败，失败原因：" + progress.endReason;
            }
        });
        let upgradeOptions = {
            order: 2
        }
        page.data.updater.upgrade(versionDigestInfo, upgradeOptions).then(result => {
            console.info(TAG + "upgrade result: " + JSON.stringify(result));
        }).catch(err => {
            console.error(TAG + "upgrade err: " + JSON.stringify(err));
        });
    },

    closeDialog() {
        this.$element('simpledialog').close();
    },

    cancelDialog() {
        prompt.showToast({
            message: '取消对话框'
        })
    },
    cancelSchedule(e) {
        this.$element('simpledialog').close()
        prompt.showToast({
            message: '取消成功'
        })
    },
    setSchedule(e) {
        this.$element('simpledialog').close()
        prompt.showToast({
            message: '确定成功'
        })
        if (page.data.pageType == "downVersion") {
            page.data.showLoad = "";
            page.data.showBanner = '';
            page.data.pageType = "newVersion";
            page.data.button = "下载更新包";
            page.data.updater.pauseDownload(versionDigestInfo, pauseDownloadOptions);
        } else if (page.data.pageType == "downSuccess") {
            page.data.upgradeInfo = "";
            page.data.showButton = 'download';
            page.data.button = "查看更新";
            page.data.pageType = "currVersion";
            page.getCurrVersion();
        } else if (page.data.pageType == "checkVersion") {
            page.data.button = "检查更新";
            page.getCurrVersion();
        }
    }
}

var EventId = {
    EVENT_TASK_BASE: 0,
    EVENT_TASK_RECEIVE: 1,
    EVENT_TASK_CANCEL: 2,
    EVENT_DOWNLOAD_WAIT: 3,
    EVENT_DOWNLOAD_START: 4,
    EVENT_PROGRESS_UPDATE: 5,
    EVENT_DOWNLOAD_PAUSE: 6,
    EVENT_DOWNLOAD_RESUME: 7,
    EVENT_DOWNLOAD_SUCCESS: 8,
    EVENT_DOWNLOAD_FAIL: 9,
    EVENT_UPGRADE_WAIT: 10,
    EVENT_UPGRADE_START: 11,
    EVENT_UPGRADE_UPDATE: 12,
    EVENT_APPLY_WAIT: 13,
    EVENT_APPLY_START: 14,
    EVENT_UPGRADE_SUCCESS: 15,
    EVENT_UPGRADE_FAIL: 16
}

export default page;