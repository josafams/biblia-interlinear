// Home page entry (index.html): the parts that come from the data (home-data.json) are Svelte components;
// the rest of the page is plain HTML (web/home.html).
import "../styles/home.css";
import { mount } from "svelte";
import { setLocale } from "../i18n";
import BookDownloads from "./BookDownloads.svelte";
import type { HomeData } from "./data";
import HomeNumbers from "./HomeNumbers.svelte";
import HomeSample from "./HomeSample.svelte";
import HowTo from "./HowTo.svelte";

const el = (id: string) => document.getElementById(id)!;
// the page is written in one locale (index.html in Portuguese, en/index.html in English): its parts follow it
setLocale(document.body.dataset.locale || "pt-BR"); // i18n-ignore

fetch("home-data.json")
  .then(r => r.json() as Promise<HomeData>)
  .then(data => {
    mount(HomeSample, { target: el("home-sample"), props: { verses: data.sample } });
    mount(HomeNumbers, { target: el("home-numbers"), props: { counts: data.counts } });
    mount(HowTo, { target: el("home-howto"), props: { storyboards: data.storyboards, root: data.root || "" } });
    mount(BookDownloads, { target: el("home-books"), props: { booksUrl: data.booksUrl, sizes: data.sizes } });
    el("home-date").textContent = data.date;
  });
